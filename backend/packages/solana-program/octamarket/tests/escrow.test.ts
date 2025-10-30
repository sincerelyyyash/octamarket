import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { OctamarketClient } from "../../src/client";
import * as chai from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("escrow", () => {
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

  it('withdraw_escrow: partial and full withdrawal succeed', async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 4_000_000);
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    const txFund = await client.fundEscrow(user.publicKey, 4_000_000, usdcMint); txFund.feePayer = user.publicKey; txFund.partialSign(user); await provider.connection.sendTransaction(txFund, [user]);
    const txWithdraw1 = await client.withdrawEscrow(user.publicKey, 1_500_000, usdcMint); txWithdraw1.feePayer = user.publicKey; txWithdraw1.partialSign(user); await provider.connection.sendTransaction(txWithdraw1, [user]);
    const txWithdraw2 = await client.withdrawEscrow(user.publicKey, 2_500_000, usdcMint); txWithdraw2.feePayer = user.publicKey; txWithdraw2.partialSign(user); await provider.connection.sendTransaction(txWithdraw2, [user]);
    const userPDA = client.getUserPDA(user.publicKey)[0];
    const vaultBalance = await client.getVaultBalance(userPDA);
    chai.expect(vaultBalance).to.be.lessThan(1000);
  });

  it('withdraw_escrow: fails if withdrawal > vault or not owner', async () => {
    const user = Keypair.generate();
    await provider.connection.requestAirdrop(user.publicKey, 2e9);
    await sleep(600);
    const userATA = (await getOrCreateAssociatedTokenAccount(provider.connection, provider.wallet.payer, usdcMint, user.publicKey)).address;
    await mintTo(provider.connection, provider.wallet.payer, usdcMint, userATA, provider.wallet.payer, 900_000);
    const txInit = await client.initUser(user.publicKey); txInit.feePayer = user.publicKey; txInit.partialSign(user); await provider.connection.sendTransaction(txInit, [user]);
    const txFund = await client.fundEscrow(user.publicKey, 900_000, usdcMint); txFund.feePayer = user.publicKey; txFund.partialSign(user); await provider.connection.sendTransaction(txFund, [user]);
    const txBad = await client.withdrawEscrow(user.publicKey, 1_500_000, usdcMint); txBad.feePayer = user.publicKey; txBad.partialSign(user);
    try { await provider.connection.sendTransaction(txBad, [user]); throw new Error('Should fail'); } catch (err: any) { chai.expect(err.message).to.match(/Insufficient escrow/i); }
    const impostor = Keypair.generate();
    await provider.connection.requestAirdrop(impostor.publicKey, 2e9);
    await sleep(600);
    const txWrong = await client.withdrawEscrow(impostor.publicKey, 800_000, usdcMint); txWrong.feePayer = impostor.publicKey; txWrong.partialSign(impostor);
    try { await provider.connection.sendTransaction(txWrong, [impostor]); throw new Error('Should fail'); } catch (err: any) { chai.expect(err.message).to.match(/signature|owner/i); }
  });
});
