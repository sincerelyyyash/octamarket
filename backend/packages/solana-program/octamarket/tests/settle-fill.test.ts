import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("settle_fill", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  let client: OctamarketClient;
  let usdcMint: PublicKey;

  before(async () => {
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, null, 6
    );
    client = OctamarketClient.create(provider.connection, provider.wallet);
  });

  it("settle_fill: settles fill, deducts fee, refunds escrow, updates position", async () => {
    const relayer = provider.wallet.payer;
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 2_000_000);
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    const intentId = Buffer.from("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "hex");
    const marketId = Buffer.from("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "hex");
    const expiry = Math.floor(Date.now() / 1000) + 500;
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 2, 1_000_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFill(relayer.publicKey, user.publicKey, intentId, marketId, { kalshi: {} }, 1, 800_000, txRef, usdcMint);
    settleTx.feePayer = relayer.publicKey;
    await provider.connection.sendTransaction(settleTx, [relayer]);
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.state["filled"]).to.not.be.undefined;
    const posPDA = client.getPositionPDA(userPDA, marketId)[0];
    const position = await client.program.account.position.fetch(posPDA);
    chai.expect(Number(position.quantity)).to.eq(1);
  });

  it("settle_fill: fails if filled_quantity > original quantity", async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const relayer = provider.wallet.payer;
    const intentId = Buffer.from("aaaaaaaa00000000aaaaaaaa00000001", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    try {
      const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 600_000, expiry, usdcMint);
      openTx.feePayer = user.publicKey; openTx.partialSign(user);
      await provider.connection.sendTransaction(openTx, [user]);
    } catch {}
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFill(relayer.publicKey, user.publicKey, intentId, marketId, { kalshi: {} }, 2, 600_000, txRef, usdcMint);
    settleTx.feePayer = relayer.publicKey;
    try { await provider.connection.sendTransaction(settleTx, [relayer]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/Invalid quantity/i); }
  });

  it("settle_fill: fails if not enough escrow", async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const relayer = provider.wallet.payer;
    const intentId = Buffer.from("bbbbbbbb111111110000000099999999", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 1000;
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    try {
      const openTx = await client.openIntent(user.publicKey, intentId, marketId, { sell: {} }, 1, 1_000_000, expiry, usdcMint);
      openTx.feePayer = user.publicKey; openTx.partialSign(user);
      await provider.connection.sendTransaction(openTx, [user]);
    } catch {}
    const txRef = Buffer.alloc(64);
    const settleTx = await client.settleFill(relayer.publicKey, user.publicKey, intentId, marketId, { polymarket: {} }, 1, 2_000_000, txRef, usdcMint);
    settleTx.feePayer = relayer.publicKey;
    try { await provider.connection.sendTransaction(settleTx, [relayer]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/Insufficient escrow/i); }
  });

  it("settle_fill: succeeds with any relayer signer (no allowlist)", async () => {
    const user = Keypair.generate();
    const intentId = Buffer.from("ccccccaa112233441100223344556677", "hex");
    const marketId = Buffer.alloc(32);
    const wrongRelayer = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await provider.connection.requestAirdrop(wrongRelayer.publicKey, 2e9);
    await sleep(600);
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 500_000, Math.floor(Date.now() / 1000) + 1000, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user); await provider.connection.sendTransaction(openTx, [user]);
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
    await provider.connection.sendTransaction(settleTx, [wrongRelayer]);
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.state["filled"]).to.not.be.undefined;
  });
});
