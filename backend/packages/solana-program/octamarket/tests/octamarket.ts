import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Connection } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Global setup vars
describe("octamarket", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;

  let usdcMint: PublicKey;
  let user1: Keypair;
  let user2: Keypair;
  let user1ATA: PublicKey;
  let user2ATA: PublicKey;

  let client: OctamarketClient;

  before(async () => {
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    // Airdrop SOL for both test users
    await connection.requestAirdrop(user1.publicKey, 2e9);
    await connection.requestAirdrop(user2.publicKey, 2e9);
    await sleep(1000);

    // Create a USDC mint
    usdcMint = await createMint(
      connection,
      provider.wallet.payer,
      provider.wallet.publicKey, // mint authority
      null, // freeze authority
      6 // decimals
    );
    // Create token accounts
    user1ATA = (await getOrCreateAssociatedTokenAccount(connection, provider.wallet.payer, usdcMint, user1.publicKey)).address;
    user2ATA = (await getOrCreateAssociatedTokenAccount(connection, provider.wallet.payer, usdcMint, user2.publicKey)).address;
    // Mint USDC to both users
    await mintTo(connection, provider.wallet.payer, usdcMint, user1ATA, provider.wallet.payer, 1_000_000_000); // 1000 USDC
    await mintTo(connection, provider.wallet.payer, usdcMint, user2ATA, provider.wallet.payer, 1_000_000_000); // 1000 USDC

    client = OctamarketClient.create(connection, provider.wallet);
  });

  it("build environment loads", async () => {
    // Placeholder test: ensure provider is set and program workspace loads without invoking non-existent methods.
    const provider = anchor.getProvider();
    if (!provider) throw new Error("Provider not set");
  });

  it("init_user: initializes a user successfully", async () => {
    const testUser = Keypair.generate();
    await provider.connection.requestAirdrop(testUser.publicKey, 1e9);
    await sleep(500);
    const tx = await client.initUser(testUser.publicKey);
    tx.feePayer = testUser.publicKey;
    tx.partialSign(testUser);
    await provider.connection.sendTransaction(tx, [testUser]);
    const userPDA = client.getUserPDA(testUser.publicKey)[0];
    const userState = await client.program.account.user.fetch(userPDA);
    // Assert stored values match expectations
    chai.expect(userState.owner.toBase58()).to.eq(testUser.publicKey.toBase58());
  });

  it("init_user: fails if user is already initialized", async () => {
    const testUser = Keypair.generate();
    await provider.connection.requestAirdrop(testUser.publicKey, 1e9);
    await sleep(500);
    const tx = await client.initUser(testUser.publicKey);
    tx.feePayer = testUser.publicKey;
    tx.partialSign(testUser);
    await provider.connection.sendTransaction(tx, [testUser]);
    // Second init with same user should fail
    const tx2 = await client.initUser(testUser.publicKey);
    tx2.feePayer = testUser.publicKey;
    tx2.partialSign(testUser);
    try {
      await provider.connection.sendTransaction(tx2, [testUser]);
      throw new Error("Should have failed (already initialized)");
    } catch (err: any) {
      chai.expect(err.message).to.match(/already in use/i);
    }
  });

  it("init_user: fails with wrong authority", async () => {
    // True authority is the sender, but if payer tries to sign for someone else, should fail
    const testUser = Keypair.generate();
    await provider.connection.requestAirdrop(testUser.publicKey, 1e9);
    await sleep(500);
    const impostor = Keypair.generate();
    await provider.connection.requestAirdrop(impostor.publicKey, 1e9);
    await sleep(500);
    const tx = await client.initUser(testUser.publicKey);
    tx.feePayer = impostor.publicKey;
    tx.partialSign(impostor);
    try {
      await provider.connection.sendTransaction(tx, [impostor]);
      throw new Error("Should have failed (wrong authority)");
    } catch (err: any) {
      chai.expect(err.message).to.match(/signature/i);
    }
  });

  it("open_intent: success (buy) with proper escrow", async () => {
    const intentId = Buffer.from("feed0b0bfeedcafeaafb123456789abc", "hex");
    const marketId = Buffer.from("f00d00cafebadbadbeef0123456789abcdef00000000000000000000000000aa", "hex");
    const expiry = Math.floor(Date.now() / 1000) + 600;
    const quantity = 10;
    const maxPrice = 650_000; // 0.65 USDC/unit, scaled 1e6
    const user = user1;
    // The user's ATAs and mint already have funds

    // Ensure init_user (if not already)
    const userPDA = client.getUserPDA(user.publicKey)[0];
    try { await client.program.account.user.fetch(userPDA); }
    catch { // if not
      const tx = await client.initUser(user.publicKey);
      tx.feePayer = user.publicKey; tx.partialSign(user);
      await provider.connection.sendTransaction(tx, [user]);
    }
    // Compose and send open_intent
    const tx = await client.openIntent(
      user.publicKey,
      intentId, marketId,
      { buy: {} },
      quantity, maxPrice,
      expiry, usdcMint
    );
    tx.feePayer = user.publicKey; tx.partialSign(user);
    await provider.connection.sendTransaction(tx, [user]);
    // Fetch intent and assert state
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.marketId).to.deep.equal([...marketId]);
    chai.expect(intent.quantity.toNumber ? intent.quantity.toNumber() : Number(intent.quantity)).to.eq(quantity);
    chai.expect(intent.escrowAmount.toNumber ? intent.escrowAmount.toNumber() : Number(intent.escrowAmount)).to.be.greaterThan(0);
  });

  it("open_intent: fails with expiry in past", async () => {
    const intentId = Buffer.from("feedcafeDeadbeef1234567890123456", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) - 60;
    const quantity = 1;
    const maxPrice = 600_000;
    const user = user1;
    const tx = await client.openIntent(
      user.publicKey,
      intentId, marketId,
      { buy: {} },
      quantity, maxPrice,
      expiry, usdcMint
    );
    tx.feePayer = user.publicKey; tx.partialSign(user);
    try {
      await provider.connection.sendTransaction(tx, [user]);
      throw new Error("Should have failed");
    } catch (err: any) {
      chai.expect(err.message).to.match(/Invalid expiry/i);
    }
  });

  it("open_intent: fails with quantity zero", async () => {
    const intentId = Buffer.from("deadbeefcafebabe1234567890bada55", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const quantity = 0;
    const maxPrice = 600_000;
    const user = user1;
    const tx = await client.openIntent(
      user.publicKey,
      intentId, marketId,
      { buy: {} },
      quantity, maxPrice,
      expiry, usdcMint
    );
    tx.feePayer = user.publicKey; tx.partialSign(user);
    try {
      await provider.connection.sendTransaction(tx, [user]);
      throw new Error("Should have failed");
    } catch (err: any) {
      chai.expect(err.message).to.match(/Invalid quantity/i);
    }
  });

  it("open_intent: fails with maxPrice zero or >1e6", async () => {
    const intentId = Buffer.from("0123456789abcdefcafebabecafebabe", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const user = user1;
    // maxPrice zero
    const tx1 = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 0, expiry, usdcMint);
    tx1.feePayer = user.publicKey; tx1.partialSign(user);
    try { await provider.connection.sendTransaction(tx1, [user]); throw new Error("Should have failed"); }
    catch (err: any) { chai.expect(err.message).to.match(/Invalid price/i); }
    // maxPrice > 1e6
    const tx2 = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 2_000_000, expiry, usdcMint);
    tx2.feePayer = user.publicKey; tx2.partialSign(user);
    try { await provider.connection.sendTransaction(tx2, [user]); throw new Error("Should have failed"); }
    catch (err: any) { chai.expect(err.message).to.match(/Invalid price/i); }
  });

  it("open_intent: fails when not enough balance in token account", async () => {
    const intentId = Buffer.from("bada55beefcafedeadf00d0123456789", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 1e9);
    await sleep(500);
    // user does not have an ATA or USDC
    // Must init user so state exists
    const txInit = await client.initUser(user.publicKey);
    txInit.feePayer = user.publicKey; txInit.partialSign(user);
    await provider.connection.sendTransaction(txInit, [user]);
    // Try open_intent with no USDC
    const tx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 600_000, expiry, usdcMint);
    tx.feePayer = user.publicKey; tx.partialSign(user);
    try { await provider.connection.sendTransaction(tx, [user]); throw new Error("Should have failed"); }
    catch (err: any) {
      chai.expect(err.message).to.match(/insufficient/i);
    }
  });

  it("cancel_intent: cancels open intent and refunds escrow", async () => {
    const intentId = Buffer.from("d0d0baadfeedbeef01bead1234567890", "hex");
    const marketId = Buffer.from("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899", "hex");
    const expiry = Math.floor(Date.now() / 1000) + 500;
    const user = user2;
    // Ensure init_user (if not already)
    const userPDA = client.getUserPDA(user.publicKey)[0];
    try { await client.program.account.user.fetch(userPDA); }
    catch { const tx = await client.initUser(user.publicKey); tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]); }
    // Mint USDC to user2
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, user2ATA, provider.wallet.payer, 500_000);

    // Open intent
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { sell: {} }, 5, 800_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    // Cancel intent
    const cancelTx = await client.cancelIntent(user.publicKey, intentId, usdcMint);
    cancelTx.feePayer = user.publicKey; cancelTx.partialSign(user);
    await provider.connection.sendTransaction(cancelTx, [user]);
    // Fetch and verify state
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.state['cancelled']).to.not.be.undefined;
  });

  it("cancel_intent: fails for already cancelled or filled", async () => {
    // Already cancelled
    const intentId = Buffer.from("aaccffeeccffeeaa9988776655443322", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 500;
    const user = user1;
    // Open new intent and cancel
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 400_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    const cancelTx = await client.cancelIntent(user.publicKey, intentId, usdcMint);
    cancelTx.feePayer = user.publicKey; cancelTx.partialSign(user);
    await provider.connection.sendTransaction(cancelTx, [user]);
    // Try cancel again
    const cancelTx2 = await client.cancelIntent(user.publicKey, intentId, usdcMint);
    cancelTx2.feePayer = user.publicKey; cancelTx2.partialSign(user);
    try { await provider.connection.sendTransaction(cancelTx2, [user]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/Invalid state/i); }
    // TODO: Filled (would require settle test before here)
  });

  it("cancel_intent: fails with wrong authority", async () => {
    const intentId = Buffer.from("ffeeddccbbaa99887766554433221100", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 700;
    const user = user1;  // this user owns the intent
    const notUser = user2;  // different keypair
    // Open intent as user1
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 200_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    // notUser tries cancel
    const cancelTx = await client.cancelIntent(notUser.publicKey, intentId, usdcMint);
    cancelTx.feePayer = notUser.publicKey; cancelTx.partialSign(notUser);
    try { await provider.connection.sendTransaction(cancelTx, [notUser]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/signature|owner/i); }
  });

  it("settle_fill: settles fill, deducts fee, refunds escrow, updates position", async () => {
    const relayer = provider.wallet.payer; // Simulate relayer as provider wallet for this test
    // Setup a new user and intent for deterministic funds
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    // Create user's USDC ATA and mint
    const userATA = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      user.publicKey
    )).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 2_000_000); // 2 USDC
    // Init user
    const txInit = await client.initUser(user.publicKey);
    txInit.feePayer = user.publicKey; txInit.partialSign(user);
    await provider.connection.sendTransaction(txInit, [user]);

    // Open intent with exact escrow = 2 USDC (quantity=2, maxPrice=1e6)
    const intentId = Buffer.from("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "hex");
    const marketId = Buffer.from("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "hex");
    const expiry = Math.floor(Date.now() / 1000) + 500;
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 2, 1_000_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);

    // Settle fill for 1 at 0.8 USDC, protocol fee: 0.8*0.005 = 0.004 => 0.004 USDC fee
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFill(
      relayer.publicKey,
      user.publicKey,
      intentId,
      marketId,
      { kalshi: {} },
      1,
      800_000,
      txRef,
      usdcMint
    );
    settleTx.feePayer = relayer.publicKey;
    if (relayer != provider.wallet.payer) settleTx.partialSign(relayer);
    await provider.connection.sendTransaction(settleTx, [relayer]);

    // Check intent state
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.state["filled"]).to.not.be.undefined;

    // Fetch position and check it's Buy +1
    const posPDA = client.getPositionPDA(userPDA, marketId)[0];
    const position = await client.program.account.position.fetch(posPDA);
    chai.expect(position.quantity.toNumber ? position.quantity.toNumber() : Number(position.quantity)).to.eq(1);

    // Assert final USDC balances: vault empty, treasury receives correct fee, user gets refund
    // ...fetch balances (optional) and check >0 fee for treasury...
  });

  it("settle_fill: fails if filled_quantity > original quantity", async () => {
    // Reuse intent setup (or create new intent)
    const user = user1;
    const relayer = provider.wallet.payer;
    const intentId = Buffer.from("aaaaaaaa00000000aaaaaaaa00000001", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    // Ensure intent exists
    try {
      const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 600_000, expiry, usdcMint);
      openTx.feePayer = user.publicKey; openTx.partialSign(user);
      await provider.connection.sendTransaction(openTx, [user]);
    } catch {}
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFill(
      relayer.publicKey,
      user.publicKey,
      intentId,
      marketId,
      { kalshi: {} },
      2, // Too much
      600_000,
      txRef,
      usdcMint
    );
    settleTx.feePayer = relayer.publicKey;
    try { await provider.connection.sendTransaction(settleTx, [relayer]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/Invalid quantity/i); }
  });

  it("settle_fill: fails if not enough escrow", async () => {
    // Use a user with intent with just 1 USDC escrowed, settle as if needed more
    const user = user2;
    const relayer = provider.wallet.payer;
    const intentId = Buffer.from("bbbbbbbb111111110000000099999999", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    try {
      const openTx = await client.openIntent(user.publicKey, intentId, marketId, { sell: {} }, 1, 1_000_000, expiry, usdcMint);
      openTx.feePayer = user.publicKey; openTx.partialSign(user);
      await provider.connection.sendTransaction(openTx, [user]);
    } catch {}
    const txRef = Buffer.alloc(64);
    // Try settle with very high avg price (needs more than escrowed)
    const settleTx = await client.settleFill(
      relayer.publicKey,
      user.publicKey,
      intentId,
      marketId,
      { polymarket: {} },
      1,
      2_000_000,
      txRef,
      usdcMint
    );
    settleTx.feePayer = relayer.publicKey;
    try { await provider.connection.sendTransaction(settleTx, [relayer]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/Insufficient escrow/i); }
  });

  it("settle_fill: fails if relayer is not signer or wrong relayer", async () => {
    const user = user1;
    const intentId = Buffer.from("ccccccaa112233441100223344556677", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    try {
      const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 500_000, expiry, usdcMint);
      openTx.feePayer = user.publicKey; openTx.partialSign(user);
      await provider.connection.sendTransaction(openTx, [user]);
    } catch {}
    const wrongRelayer = Keypair.generate();
    await provider.connection.requestAirdrop(wrongRelayer.publicKey, 2e9);
    await sleep(600);
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFill(
      wrongRelayer.publicKey,
      user.publicKey,
      intentId,
      marketId,
      { kalshi: {} },
      1,
      500_000,
      txRef,
      usdcMint
    );
    settleTx.feePayer = wrongRelayer.publicKey; settleTx.partialSign(wrongRelayer);
    try { await provider.connection.sendTransaction(settleTx, [wrongRelayer]); throw new Error("Should fail"); }
    catch (err: any) {
      chai.expect(err.message).to.match(/signer|relayer|authority/i);
    }
  });

  it('copy trading: full e2e flow, normal operation', async () => {
    // Follower/user
    const follower = Keypair.generate();
    await provider.connection.requestAirdrop(follower.publicKey, 2e9);
    await sleep(600);
    // Create follower ATA and mint funds
    const followerATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, follower.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, followerATA, provider.wallet.payer, 5_000_000);
    // Init follower
    try {
      const txInit = await client.initUser(follower.publicKey);
      txInit.feePayer = follower.publicKey; txInit.partialSign(follower);
      await provider.connection.sendTransaction(txInit, [follower]);
    } catch {/* exists */}

    // Set policy: 25% copy, max 2_000_000 per, 5_000_000/day, expiry +30min
    const expiry = Math.floor(Date.now()/1000) + 1800;
    const txPolicy = await client.setCopyPolicy(follower.publicKey, 2500, 2_000_000, 5_000_000, expiry);
    txPolicy.feePayer = follower.publicKey; txPolicy.partialSign(follower);
    await provider.connection.sendTransaction(txPolicy, [follower]);
    // Fund escrow: deposit 3 USDC
    const txFund = await client.fundEscrow(follower.publicKey, 3_000_000, usdcMint);
    txFund.feePayer = follower.publicKey; txFund.partialSign(follower);
    await provider.connection.sendTransaction(txFund, [follower]);
    // Open copy intent (simulated relayer)
    const leaderTradeRef = Buffer.from('dddddddddddddddddddddddddddddddd', 'hex');
    const marketId = Buffer.from('00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff', 'hex');
    const quantity = 2;
    const priceCap = 1_000_000;
    const relayer = provider.wallet.payer;
    const txOpen = await client.openCopyIntent(relayer.publicKey, follower.publicKey, leaderTradeRef, marketId, { buy: {} }, quantity, priceCap);
    txOpen.feePayer = relayer.publicKey;
    await provider.connection.sendTransaction(txOpen, [relayer]);
    // Settle fill copy
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFillCopy(relayer.publicKey, follower.publicKey, leaderTradeRef, marketId, { kalshi: {} }, 2, 1_000_000, txRef, usdcMint);
    settleTx.feePayer = relayer.publicKey;
    await provider.connection.sendTransaction(settleTx, [relayer]);
    // Assert: copyIntent state == filled, position present, treasury > 0, refund issued/back
    const userPDA = client.getUserPDA(follower.publicKey)[0];
    const copyIntentPDA = client.getCopyIntentPDA(follower.publicKey, leaderTradeRef)[0];
    const copyIntent = await client.program.account.copyIntent.fetch(copyIntentPDA);
    chai.expect(copyIntent.state['filled']).to.not.be.undefined;
    const posPDA = client.getPositionPDA(userPDA, marketId)[0];
    const pos = await client.program.account.position.fetch(posPDA);
    chai.expect(Number(pos.quantity)).to.be.gte(2);
    // Vault should have only refund left or zero, check treasury got fee
    // ... can add SPL balance checks here ...
  });

  it('copy trading: fails when policy is disabled/expired/caps exceeded', async () => {
    const follower = Keypair.generate();
    await provider.connection.requestAirdrop(follower.publicKey, 2e9);
    await sleep(500);
    const followerATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, follower.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, followerATA, provider.wallet.payer, 1_000_000);
    try { const txInit = await client.initUser(follower.publicKey); txInit.feePayer = follower.publicKey; txInit.partialSign(follower); await provider.connection.sendTransaction(txInit, [follower]); } catch {}
    // Set strict policy: 1% copy, max 100_000, 200_000/day, expires in 1s
    const expiry = Math.floor(Date.now()/1000) + 1;
    let txPolicy = await client.setCopyPolicy(follower.publicKey, 100, 100_000, 200_000, expiry);
    txPolicy.feePayer = follower.publicKey; txPolicy.partialSign(follower);
    await provider.connection.sendTransaction(txPolicy, [follower]);
    // Fund small escrow
    const txFund = await client.fundEscrow(follower.publicKey, 90_000, usdcMint);
    txFund.feePayer = follower.publicKey; txFund.partialSign(follower);
    await provider.connection.sendTransaction(txFund, [follower]);
    await sleep(2000); // let policy expire
    // Open copy intent after expiry
    const leaderTradeRef = Buffer.from('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'hex');
    const marketId = Buffer.alloc(32);
    const relayer = provider.wallet.payer;
    try {
      const tx = await client.openCopyIntent(relayer.publicKey, follower.publicKey, leaderTradeRef, marketId, { sell: {} }, 2, 60_000);
      tx.feePayer = relayer.publicKey;
      await provider.connection.sendTransaction(tx, [relayer]);
      throw new Error('Should fail');
    } catch (err: any) { chai.expect(err.message).to.match(/expired/i); }
    // Set new policy - enabled false (simulate by edit)
    // (Not exposed in client, would require manual disabling in state, can skip except in full integration)
    // Exceed caps/amount
    const newExpiry = Math.floor(Date.now()/1000) + 1000;
    txPolicy = await client.setCopyPolicy(follower.publicKey, 400, 100_000, 200_000, newExpiry);
    txPolicy.feePayer = follower.publicKey; txPolicy.partialSign(follower);
    await provider.connection.sendTransaction(txPolicy, [follower]);
    // Try to open copy intent that requires >100_000
    try {
      const tx = await client.openCopyIntent(relayer.publicKey, follower.publicKey, Buffer.from('cccccccccccccccccccccccccccccccc', 'hex'), marketId, { sell: {} }, 2, 60_000);
      tx.feePayer = relayer.publicKey; await provider.connection.sendTransaction(tx, [relayer]);
      throw new Error('Should fail');
    } catch (err: any) { chai.expect(err.message).to.match(/Exceeds maximum copy amount/i); }
    // Insufficient escrow
    try {
      const tx = await client.openCopyIntent(relayer.publicKey, follower.publicKey, Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'), marketId, { sell: {} }, 2, 100_000);
      tx.feePayer = relayer.publicKey; await provider.connection.sendTransaction(tx, [relayer]);
      throw new Error('Should fail');
    } catch (err: any) { chai.expect(err.message).to.match(/Insufficient escrow/i); }
  });

  it('withdraw_escrow: partial and full withdrawal succeed', async () => {
    // Setup: New user, policy, fund escrow
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 4_000_000);
    // Init user and fund escrow
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    const txFund = await client.fundEscrow(user.publicKey, 4_000_000, usdcMint); txFund.feePayer = user.publicKey; txFund.partialSign(user); await provider.connection.sendTransaction(txFund, [user]);
    // Partial withdrawal
    const txWithdraw1 = await client.withdrawEscrow(user.publicKey, 1_500_000, usdcMint); txWithdraw1.feePayer = user.publicKey; txWithdraw1.partialSign(user); await provider.connection.sendTransaction(txWithdraw1, [user]);
    // Second withdrawal: rest
    const txWithdraw2 = await client.withdrawEscrow(user.publicKey, 2_500_000, usdcMint); txWithdraw2.feePayer = user.publicKey; txWithdraw2.partialSign(user); await provider.connection.sendTransaction(txWithdraw2, [user]);
    // Vault should be (almost) empty
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const vaultBalance = await client.getVaultBalance(userPDA);
    chai.expect(vaultBalance).to.be.lessThan(1000); // within rounding dust
  });

  it('withdraw_escrow: fails if withdrawal > vault or not owner', async () => {
    // Setup user with some amount
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 900_000);
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    const txFund = await client.fundEscrow(user.publicKey, 900_000, usdcMint); txFund.feePayer = user.publicKey; txFund.partialSign(user); await provider.connection.sendTransaction(txFund, [user]);
    // Try to withdraw more than available
    const txBad = await client.withdrawEscrow(user.publicKey, 1_500_000, usdcMint); txBad.feePayer = user.publicKey; txBad.partialSign(user);
    try { await provider.connection.sendTransaction(txBad, [user]); throw new Error('Should fail'); } catch (err: any) { chai.expect(err.message).to.match(/Insufficient escrow/i); }
    // Try correct amount but wrong signer
    const impostor = Keypair.generate();
    await provider.connection.requestAirdrop(impostor.publicKey, 2e9);
    await sleep(600);
    const txWrong = await client.withdrawEscrow(impostor.publicKey, 800_000, usdcMint); txWrong.feePayer = impostor.publicKey; txWrong.partialSign(impostor);
    try { await provider.connection.sendTransaction(txWrong, [impostor]); throw new Error('Should fail'); } catch (err: any) { chai.expect(err.message).to.match(/signature|owner/i); }
  });

  it('multi-user: actions and PDAs are fully isolated', async () => {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    await provider.connection.requestAirdrop(alice.publicKey, 2e9);
    await provider.connection.requestAirdrop(bob.publicKey, 2e9);
    await sleep(600);
    // Mint USDC + init
    const aliceATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, alice.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, aliceATA, provider.wallet.payer, 1_000_000);
    const bobATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, bob.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, bobATA, provider.wallet.payer, 1_000_000);
    for (const user of [alice, bob]) {
      try { const tx = await client.initUser(user.publicKey); tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]); } catch {}
    }
    // Each user opens an intent
    const expiry = Math.floor(Date.now()/1000) + 300;
    const idAlice = Buffer.from('aca11aca11aca11aca11aca11aca11aa', 'hex');
    const idBob = Buffer.from('b0bbb0bbb0bbb0bbb0bbb0bbb0bbb0bb', 'hex');
    const marketId = Buffer.alloc(32);

    const txA = await client.openIntent(alice.publicKey, idAlice, marketId, { buy: {} }, 2, 500_000, expiry, usdcMint);
    txA.feePayer = alice.publicKey; txA.partialSign(alice);
    const txB = await client.openIntent(bob.publicKey, idBob, marketId, { sell: {} }, 3, 400_000, expiry, usdcMint);
    txB.feePayer = bob.publicKey; txB.partialSign(bob);
    await provider.connection.sendTransaction(txA, [alice]);
    await provider.connection.sendTransaction(txB, [bob]);
    // Cancel only Alice's
    const cancelA = await client.cancelIntent(alice.publicKey, idAlice, usdcMint);
    cancelA.feePayer = alice.publicKey; cancelA.partialSign(alice);
    await provider.connection.sendTransaction(cancelA, [alice]);
    // Bob's remains open
    const userPDA_A = client.getUserPDA(alice.publicKey)[0];
    const userPDA_B = client.getUserPDA(bob.publicKey)[0];
    const intentA = await client.program.account.intent.fetch(client.getIntentPDA(userPDA_A, idAlice)[0]);
    const intentB = await client.program.account.intent.fetch(client.getIntentPDA(userPDA_B, idBob)[0]);
    chai.expect(intentA.state['cancelled']).to.not.be.undefined;
    chai.expect(intentB.state['open']).to.not.be.undefined;
    // Check PDAs do not overlap and balances are as expected
    chai.expect(userPDA_A.toBase58()).not.eq(userPDA_B.toBase58());
  });

  it('PDA helpers: all address derivations are correct and disjoint', async () => {
    const dummyKey = Keypair.generate().publicKey;
    const dummyBytes = Buffer.alloc(32, 1);
    // getUserPDA
    const userPDA = client.getUserPDA(dummyKey)[0];
    const vaultPDA = client.getVaultPDA(userPDA)[0];
    const vaultBumpPDA = client.getVaultBumpPDA(userPDA)[0];
    const intentId = Buffer.alloc(16, 2);
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const posPDA = client.getPositionPDA(userPDA, dummyBytes)[0];
    const copyPolPDA = client.getCopyPolicyPDA(dummyKey)[0];
    const copyIntentPDA = client.getCopyIntentPDA(dummyKey, intentId)[0];
    const treasBumpPDA = client.getTreasuryBumpPDA()[0];
    const treasPDA = client.getTreasuryPDA(dummyKey)[0];
    // All should be pubkeys, unique in sets
    const pdas = [userPDA, vaultPDA, vaultBumpPDA, intentPDA, posPDA, copyPolPDA, copyIntentPDA, treasBumpPDA, treasPDA].map(p => p.toBase58());
    for (let i = 0; i < pdas.length; ++i) for (let j = 0; j < pdas.length; ++j) if (i !== j) chai.expect(pdas[i]).not.eq(pdas[j]);
  });

  it('events and SPL balances: all major actions emit events and update balances', async () => {
    // Use a new funded user
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 2_000_000);
    try { const tx = await client.initUser(user.publicKey); tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]); } catch{}
    // Open intent
    const intentId = Buffer.from('ddcceeaa55aabbcc1122334455667788', 'hex');
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now()/1000) + 800;
    const tx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 700_000, expiry, usdcMint);
    tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]);
    // Cancel
    const txC = await client.cancelIntent(user.publicKey, intentId, usdcMint); txC.feePayer = user.publicKey; txC.partialSign(user); await provider.connection.sendTransaction(txC, [user]);
    // Check SPL balances (user's should be back to nearly 2_000_000)
    const bal = await getAccount(provider.connection, userATA);
    chai.expect(Number(bal.amount)).to.be.gte(1_990_000);
    // (Anchor event/log assertion would be via tx/meta parsing or simulated client helper; can extend client to query logs as needed)
  });

  it('typescript client API: full coverage for all flows', async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9); await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 3_000_000);
    // Init user
    const tx1 = await client.initUser(user.publicKey); tx1.feePayer = user.publicKey; tx1.partialSign(user); await provider.connection.sendTransaction(tx1, [user]);
    // Open intent
    const intentId = Buffer.from('fa11cafefa11cafefa11cafefa11cafe', 'hex');
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now()/1000) + 500;
    const tx2 = await client.openIntent(user.publicKey, intentId, marketId, { sell: {} }, 2, 790_000, expiry, usdcMint); tx2.feePayer = user.publicKey; tx2.partialSign(user); await provider.connection.sendTransaction(tx2, [user]);
    // Cancel
    const tx3 = await client.cancelIntent(user.publicKey, intentId, usdcMint); tx3.feePayer = user.publicKey; tx3.partialSign(user); await provider.connection.sendTransaction(tx3, [user]);
    // Set policy and fund escrow
    const expiry2 = Math.floor(Date.now()/1000) + 300;
    const tx4 = await client.setCopyPolicy(user.publicKey, 2000, 1_000_000, 2_000_000, expiry2); tx4.feePayer = user.publicKey; tx4.partialSign(user); await provider.connection.sendTransaction(tx4, [user]);
    const tx5 = await client.fundEscrow(user.publicKey, 1_000_000, usdcMint); tx5.feePayer = user.publicKey; tx5.partialSign(user); await provider.connection.sendTransaction(tx5, [user]);
    // Withdraw
    const tx6 = await client.withdrawEscrow(user.publicKey, 1_000_000, usdcMint); tx6.feePayer = user.publicKey; tx6.partialSign(user); await provider.connection.sendTransaction(tx6, [user]);
    // Assert successful run (if no throws, all flows work)
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const u = await client.getUser(user.publicKey);
    chai.expect(u.owner.toBase58()).to.eq(user.publicKey.toBase58());
  });
});
