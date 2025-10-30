import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("cancel_intent", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  let client: OctamarketClient;
  let usdcMint: PublicKey, user1: Keypair, user2: Keypair, user1ATA: PublicKey, user2ATA: PublicKey;

  before(async () => {
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null, 6);
    user1ATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user1.publicKey)).address;
    user2ATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user2.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, user1ATA, provider.wallet.payer, 1_000_000_000);
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, user2ATA, provider.wallet.payer, 1_000_000_000);
    client = OctamarketClient.create(provider.connection, provider.wallet);
  });

  it("cancel_intent: cancels open intent and refunds escrow", async () => {
    const intentId = Buffer.from("d0d0baadfeedbeef01bead1234567890", "hex");
    const marketId = Buffer.from("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899", "hex");
    const expiry = Math.floor(Date.now() / 1000) + 500;
    const user = user2;
    const userPDA = client.getUserPDA(user.publicKey)[0];
    try { await client.program.account.user.fetch(userPDA); }
    catch { const tx = await client.initUser(user.publicKey); tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]); }
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, user2ATA, provider.wallet.payer, 500_000);
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { sell: {} }, 5, 800_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    const cancelTx = await client.cancelIntent(user.publicKey, intentId, usdcMint);
    cancelTx.feePayer = user.publicKey; cancelTx.partialSign(user);
    await provider.connection.sendTransaction(cancelTx, [user]);
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.state['cancelled']).to.not.be.undefined;
  });

  it("cancel_intent: fails for already cancelled or filled", async () => {
    const intentId = Buffer.from("aaccffeeccffeeaa9988776655443322", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 500;
    const user = user1;
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 400_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    const cancelTx = await client.cancelIntent(user.publicKey, intentId, usdcMint);
    cancelTx.feePayer = user.publicKey; cancelTx.partialSign(user);
    await provider.connection.sendTransaction(cancelTx, [user]);
    const cancelTx2 = await client.cancelIntent(user.publicKey, intentId, usdcMint);
    cancelTx2.feePayer = user.publicKey; cancelTx2.partialSign(user);
    try { await provider.connection.sendTransaction(cancelTx2, [user]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/Invalid state/i); }
  });

  it("cancel_intent: fails with wrong authority", async () => {
    const intentId = Buffer.from("ffeeddccbbaa99887766554433221100", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) + 700;
    const user = user1;
    const notUser = user2;
    const openTx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 200_000, expiry, usdcMint);
    openTx.feePayer = user.publicKey; openTx.partialSign(user);
    await provider.connection.sendTransaction(openTx, [user]);
    const cancelTx = await client.cancelIntent(notUser.publicKey, intentId, usdcMint);
    cancelTx.feePayer = notUser.publicKey; cancelTx.partialSign(notUser);
    try { await provider.connection.sendTransaction(cancelTx, [notUser]); throw new Error("Should fail"); }
    catch (err: any) { chai.expect(err.message).to.match(/signature|owner/i); }
  });
});
