import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("copy_intent", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  let client: OctamarketClient, usdcMint: PublicKey;

  before(async () => {
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, null, 6
    );
    client = OctamarketClient.create(provider.connection, provider.wallet);
  });

  it('copy trading: full e2e flow, normal operation', async () => {
    const follower = Keypair.generate();
    await provider.connection.requestAirdrop(follower.publicKey, 2e9);
    await sleep(600);
    const followerATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, follower.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, followerATA, provider.wallet.payer, 5_000_000);
    try {
      const txInit = await client.initUser(follower.publicKey);
      txInit.feePayer = follower.publicKey; txInit.partialSign(follower);
      await provider.connection.sendTransaction(txInit, [follower]);
    } catch {/* exists */}
    // Set policy
    const expiry = Math.floor(Date.now()/1000) + 1800;
    const txPolicy = await client.setCopyPolicy(follower.publicKey, 2500, 2_000_000, 5_000_000, expiry);
    txPolicy.feePayer = follower.publicKey; txPolicy.partialSign(follower);
    await provider.connection.sendTransaction(txPolicy, [follower]);
    // Fund escrow
    const txFund = await client.fundEscrow(follower.publicKey, 3_000_000, usdcMint);
    txFund.feePayer = follower.publicKey; txFund.partialSign(follower);
    await provider.connection.sendTransaction(txFund, [follower]);
    // Open copy intent
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
    // Assert copyIntent state == filled, position present
    const userPDA = client.getUserPDA(follower.publicKey)[0];
    const copyIntentPDA = client.getCopyIntentPDA(follower.publicKey, leaderTradeRef)[0];
    const copyIntent = await client.program.account.copyIntent.fetch(copyIntentPDA);
    chai.expect(copyIntent.state['filled']).to.not.be.undefined;
    const posPDA = client.getPositionPDA(userPDA, marketId)[0];
    const pos = await client.program.account.position.fetch(posPDA);
    chai.expect(Number(pos.quantity)).to.be.gte(2);
  });

  it('copy trading: fails when policy is disabled/expired/caps exceeded', async () => {
    const follower = Keypair.generate();
    await provider.connection.requestAirdrop(follower.publicKey, 2e9);
    await sleep(500);
    const followerATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, follower.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, followerATA, provider.wallet.payer, 1_000_000);
    try { const txInit = await client.initUser(follower.publicKey); txInit.feePayer = follower.publicKey; txInit.partialSign(follower); await provider.connection.sendTransaction(txInit, [follower]); } catch {}
    // Set very strict, short policy
    const expiry = Math.floor(Date.now()/1000) + 1;
    let txPolicy = await client.setCopyPolicy(follower.publicKey, 100, 100_000, 200_000, expiry);
    txPolicy.feePayer = follower.publicKey; txPolicy.partialSign(follower);
    await provider.connection.sendTransaction(txPolicy, [follower]);
    // Fund small escrow
    const txFund = await client.fundEscrow(follower.publicKey, 90_000, usdcMint);
    txFund.feePayer = follower.publicKey; txFund.partialSign(follower);
    await provider.connection.sendTransaction(txFund, [follower]);
    await sleep(2000);
    const leaderTradeRef = Buffer.from('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'hex');
    const marketId = Buffer.alloc(32);
    const relayer = provider.wallet.payer;
    try {
      const tx = await client.openCopyIntent(relayer.publicKey, follower.publicKey, leaderTradeRef, marketId, { sell: {} }, 2, 60_000);
      tx.feePayer = relayer.publicKey;
      await provider.connection.sendTransaction(tx, [relayer]);
      throw new Error('Should fail');
    } catch (err: any) { chai.expect(err.message).to.match(/expired/i); }
    // Set new policy for caps
    const newExpiry = Math.floor(Date.now()/1000) + 1000;
    txPolicy = await client.setCopyPolicy(follower.publicKey, 400, 100_000, 200_000, newExpiry);
    txPolicy.feePayer = follower.publicKey; txPolicy.partialSign(follower);
    await provider.connection.sendTransaction(txPolicy, [follower]);
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
});
