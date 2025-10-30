import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("user", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  let client: OctamarketClient;

  before(async () => {
    client = OctamarketClient.create(provider.connection, provider.wallet);
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
});
