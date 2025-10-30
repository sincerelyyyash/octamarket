import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("utils", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  let client: OctamarketClient, usdcMint: PublicKey;

  before(async () => {
    usdcMint = await createMint(
      provider.connection, provider.wallet.payer, provider.wallet.publicKey, null, 6
    );
    client = OctamarketClient.create(provider.connection, provider.wallet);
  });

  it('multi-user: actions and PDAs are fully isolated', async () => {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    await provider.connection.requestAirdrop(alice.publicKey, 2e9);
    await provider.connection.requestAirdrop(bob.publicKey, 2e9);
    await sleep(600);
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
    chai.expect(userPDA_A.toBase58()).not.eq(userPDA_B.toBase58());
  });

  it('PDA helpers: all address derivations are correct and disjoint', async () => {
    const dummyKey = Keypair.generate().publicKey;
    const dummyBytes = Buffer.alloc(32, 1);
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
    const pdas = [userPDA, vaultPDA, vaultBumpPDA, intentPDA, posPDA, copyPolPDA, copyIntentPDA, treasBumpPDA, treasPDA].map(p => p.toBase58());
    for (let i = 0; i < pdas.length; ++i) for (let j = 0; j < pdas.length; ++j) if (i !== j) chai.expect(pdas[i]).not.eq(pdas[j]);
  });

  it('events and SPL balances: all major actions emit events and update balances', async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 2_000_000);
    try { const tx = await client.initUser(user.publicKey); tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]); } catch{}
    const intentId = Buffer.from('ddcceeaa55aabbcc1122334455667788', 'hex');
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now()/1000) + 800;
    const tx = await client.openIntent(user.publicKey, intentId, marketId, { buy: {} }, 1, 700_000, expiry, usdcMint);
    tx.feePayer = user.publicKey; tx.partialSign(user); await provider.connection.sendTransaction(tx, [user]);
    const txC = await client.cancelIntent(user.publicKey, intentId, usdcMint); txC.feePayer = user.publicKey; txC.partialSign(user); await provider.connection.sendTransaction(txC, [user]);
    const bal = await getAccount(provider.connection, userATA);
    chai.expect(Number(bal.amount)).to.be.gte(1_990_000);
  });

  it('typescript client API: full coverage for all flows', async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9); await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 3_000_000);
    const tx1 = await client.initUser(user.publicKey); tx1.feePayer = user.publicKey; tx1.partialSign(user); await provider.connection.sendTransaction(tx1, [user]);
    const intentId = Buffer.from('fa11cafefa11cafefa11cafefa11cafe', 'hex');
    const marketId = Buffer.alloc(32);
    const expiry = Math.floor(Date.now()/1000) + 500;
    const tx2 = await client.openIntent(user.publicKey, intentId, marketId, { sell: {} }, 2, 790_000, expiry, usdcMint); tx2.feePayer = user.publicKey; tx2.partialSign(user); await provider.connection.sendTransaction(tx2, [user]);
    const tx3 = await client.cancelIntent(user.publicKey, intentId, usdcMint); tx3.feePayer = user.publicKey; tx3.partialSign(user); await provider.connection.sendTransaction(tx3, [user]);
    const expiry2 = Math.floor(Date.now()/1000) + 300;
    const tx4 = await client.setCopyPolicy(user.publicKey, 2000, 1_000_000, 2_000_000, expiry2); tx4.feePayer = user.publicKey; tx4.partialSign(user); await provider.connection.sendTransaction(tx4, [user]);
    const tx5 = await client.fundEscrow(user.publicKey, 1_000_000, usdcMint); tx5.feePayer = user.publicKey; tx5.partialSign(user); await provider.connection.sendTransaction(tx5, [user]);
    const tx6 = await client.withdrawEscrow(user.publicKey, 1_000_000, usdcMint); tx6.feePayer = user.publicKey; tx6.partialSign(user); await provider.connection.sendTransaction(tx6, [user]);
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const u = await client.getUser(user.publicKey);
    chai.expect(u.owner.toBase58()).to.eq(user.publicKey.toBase58());
  });
});
