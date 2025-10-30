import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("intent", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  let client: OctamarketClient;
  let usdcMint: PublicKey;
  let user1: Keypair;
  let user1ATA: PublicKey;

  before(async () => {
    user1 = Keypair.generate();
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, null, 6
    );
    user1ATA = (
      await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user1.publicKey)
    ).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, user1ATA, provider.wallet.payer, 1_000_000_000);
    client = OctamarketClient.create(provider.connection, provider.wallet);
  });

  it("open_intent: success (buy) with proper escrow", async () => {
    const intentId = Buffer.from("feed0b0bfeedcafeaafb123456789abc", "hex");
    const marketId = Buffer.from("f00d00cafebadbadbeef0123456789abcdef00000000000000000000000000aa", "hex");
    const expiry = Math.floor(Date.now() / 1000) + 600;
    const quantity = 10;
    const maxPrice = 650_000;
    const user = user1;
    const userPDA = client.getUserPDA(user.publicKey)[0];
    try { await client.program.account.user.fetch(userPDA); }
    catch {
      const tx = await client.initUser(user.publicKey);
      tx.feePayer = user.publicKey; tx.partialSign(user);
      await provider.connection.sendTransaction(tx, [user]);
    }
    const tx = await client.openIntent(
      user.publicKey,
      intentId, marketId,
      { buy: {} },
      quantity, maxPrice,
      expiry, usdcMint
    );
    tx.feePayer = user.publicKey; tx.partialSign(user);
    await provider.connection.sendTransaction(tx, [user]);
    const intentPDA = client.getIntentPDA(userPDA, intentId)[0];
    const intent = await client.program.account.intent.fetch(intentPDA);
    chai.expect(intent.marketId).to.deep.equal([...marketId]);
    chai.expect(Number(intent.quantity)).to.eq(quantity);
    chai.expect(Number(intent.escrowAmount)).to.be.greaterThan(0);
  });

  it("open_intent: fails with expiry in past", async () => {
    const intentId = Buffer.from("feedcafeDeadbeef1234567890123456", "hex");
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now() / 1000) - 60;
    const quantity = 1;
    const maxPrice = 600_000;
    const user = user1;
    const tx = await client.openIntent(
      user.publicKey, intentId, marketId,
      { buy: {} }, quantity, maxPrice, expiry, usdcMint
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
      user.publicKey, intentId, marketId,
      { buy: {} }, quantity, maxPrice, expiry, usdcMint
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
    const txInit = await client.initUser(user.publicKey);
    txInit.feePayer = user.publicKey; txInit.partialSign(user);
    await provider.connection.sendTransaction(txInit, [user]);
    const tx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 600_000, expiry, usdcMint);
    tx.feePayer = user.publicKey; tx.partialSign(user);
    try { await provider.connection.sendTransaction(tx, [user]); throw new Error("Should have failed"); }
    catch (err: any) {
      chai.expect(err.message).to.match(/insufficient/i);
    }
  });
});
