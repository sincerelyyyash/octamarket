import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import IDL from '../idl/octamarket.json';

export { IDL };

export const PROGRAM_ID = new web3.PublicKey('DSzcxNHsezokjETdk9ymJYvR27bGS876g2EqoVxQraQE');

export class OctamarketClient {
  constructor(
    public program: Program<any>,
    public provider: AnchorProvider
  ) {}

  static create(connection: web3.Connection, wallet: any): OctamarketClient {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    const program = new Program(IDL as any, PROGRAM_ID, provider);
    return new OctamarketClient(program, provider);
  }

  // PDA helpers
  getUserPDA(owner: web3.PublicKey): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('user'), owner.toBuffer()],
      this.program.programId
    );
  }

  getIntentPDA(userPDA: web3.PublicKey, intentId: Buffer): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('intent'), userPDA.toBuffer(), intentId],
      this.program.programId
    );
  }

  getPositionPDA(userPDA: web3.PublicKey, marketId: Buffer): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('position'), userPDA.toBuffer(), marketId],
      this.program.programId
    );
  }

  getVaultBumpPDA(userPDA: web3.PublicKey): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('vault_bump'), userPDA.toBuffer()],
      this.program.programId
    );
  }

  getVaultPDA(userPDA: web3.PublicKey): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), userPDA.toBuffer()],
      this.program.programId
    );
  }

  getCopyPolicyPDA(follower: web3.PublicKey): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('copy_policy'), follower.toBuffer()],
      this.program.programId
    );
  }

  getCopyIntentPDA(follower: web3.PublicKey, leaderTradeRef: Buffer): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('copy_intent'), follower.toBuffer(), leaderTradeRef],
      this.program.programId
    );
  }

  getTreasuryBumpPDA(): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('treasury_bump')],
      this.program.programId
    );
  }

  getTreasuryPDA(usdcMint: web3.PublicKey): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), usdcMint.toBuffer()],
      this.program.programId
    );
  }

  // Instructions
  async initUser(owner: web3.PublicKey, kycHash?: Uint8Array): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(owner);

    return this.program.methods
      .initUser(kycHash ? Array.from(kycHash) : null)
      .accounts({
        user: userPDA,
        owner,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();
  }

  async openIntent(
    owner: web3.PublicKey,
    intentId: Buffer,
    marketId: Buffer,
    side: { buy: {} } | { sell: {} },
    quantity: number,
    maxPrice: number,
    expiry: number,
    usdcMint: web3.PublicKey
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(owner);
    const [intentPDA] = this.getIntentPDA(userPDA, intentId);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);
    const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, owner);

    return this.program.methods
      .openIntent(
        Array.from(intentId),
        Array.from(marketId),
        side,
        quantity,
        maxPrice,
        expiry
      )
      .accounts({
        user: userPDA,
        intent: intentPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        userTokenAccount,
        usdcMint,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .transaction();
  }

  async cancelIntent(
    owner: web3.PublicKey,
    intentId: Buffer,
    usdcMint: web3.PublicKey
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(owner);
    const [intentPDA] = this.getIntentPDA(userPDA, intentId);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);
    const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, owner);

    return this.program.methods
      .cancelIntent()
      .accounts({
        user: userPDA,
        intent: intentPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        userTokenAccount,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  async settleFill(
    relayer: web3.PublicKey,
    userOwner: web3.PublicKey,
    intentId: Buffer,
    marketId: Buffer,
    venue: { kalshi: {} } | { polymarket: {} },
    filledQuantity: number,
    avgPrice: number,
    txRef: Buffer,
    usdcMint: web3.PublicKey
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(userOwner);
    const [intentPDA] = this.getIntentPDA(userPDA, intentId);
    const [positionPDA] = this.getPositionPDA(userPDA, marketId);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);
    const [treasuryBumpPDA] = this.getTreasuryBumpPDA();
    const [treasuryPDA] = this.getTreasuryPDA(usdcMint);
    const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, userOwner);

    return this.program.methods
      .settleFill(venue, filledQuantity, avgPrice, Array.from(txRef))
      .accounts({
        user: userPDA,
        intent: intentPDA,
        position: positionPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        userTokenAccount,
        treasuryBump: treasuryBumpPDA,
        treasury: treasuryPDA,
        usdcMint,
        relayer,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();
  }

  async setCopyPolicy(
    owner: web3.PublicKey,
    copyPercentage: number,
    maxCopyAmount: number,
    maxDailyAmount: number,
    expiry: number
  ): Promise<web3.Transaction> {
    const [copyPolicyPDA] = this.getCopyPolicyPDA(owner);

    return this.program.methods
      .setCopyPolicy(copyPercentage, maxCopyAmount, maxDailyAmount, expiry)
      .accounts({
        copyPolicy: copyPolicyPDA,
        owner,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();
  }

  async fundEscrow(
    owner: web3.PublicKey,
    amount: number,
    usdcMint: web3.PublicKey
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(owner);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);
    const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, owner);

    return this.program.methods
      .fundEscrow(amount)
      .accounts({
        user: userPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        userTokenAccount,
        usdcMint,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .transaction();
  }

  async withdrawEscrow(
    owner: web3.PublicKey,
    amount: number,
    usdcMint: web3.PublicKey
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(owner);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);
    const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, owner);

    return this.program.methods
      .withdrawEscrow(amount)
      .accounts({
        user: userPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        userTokenAccount,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  async openCopyIntent(
    relayer: web3.PublicKey,
    follower: web3.PublicKey,
    leaderTradeRef: Buffer,
    marketId: Buffer,
    side: { buy: {} } | { sell: {} },
    quantity: number,
    priceCap: number
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(follower);
    const [copyPolicyPDA] = this.getCopyPolicyPDA(follower);
    const [copyIntentPDA] = this.getCopyIntentPDA(follower, leaderTradeRef);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);

    return this.program.methods
      .openCopyIntent(
        Array.from(leaderTradeRef),
        Array.from(marketId),
        side,
        quantity,
        priceCap
      )
      .accounts({
        user: userPDA,
        copyPolicy: copyPolicyPDA,
        copyIntent: copyIntentPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        relayer,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();
  }

  async settleFillCopy(
    relayer: web3.PublicKey,
    follower: web3.PublicKey,
    leaderTradeRef: Buffer,
    marketId: Buffer,
    venue: { kalshi: {} } | { polymarket: {} },
    filledQuantity: number,
    avgPrice: number,
    txRef: Buffer,
    usdcMint: web3.PublicKey
  ): Promise<web3.Transaction> {
    const [userPDA] = this.getUserPDA(follower);
    const [copyIntentPDA] = this.getCopyIntentPDA(follower, leaderTradeRef);
    const [positionPDA] = this.getPositionPDA(userPDA, marketId);
    const [vaultBumpPDA] = this.getVaultBumpPDA(userPDA);
    const [vaultPDA] = this.getVaultPDA(userPDA);
    const [treasuryBumpPDA] = this.getTreasuryBumpPDA();
    const [treasuryPDA] = this.getTreasuryPDA(usdcMint);
    const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, follower);

    return this.program.methods
      .settleFillCopy(venue, filledQuantity, avgPrice, Array.from(txRef))
      .accounts({
        user: userPDA,
        copyIntent: copyIntentPDA,
        position: positionPDA,
        vaultBump: vaultBumpPDA,
        vault: vaultPDA,
        userTokenAccount,
        treasuryBump: treasuryBumpPDA,
        treasury: treasuryPDA,
        usdcMint,
        relayer,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();
  }

  // Query methods
  async getUser(owner: web3.PublicKey) {
    const [userPDA] = this.getUserPDA(owner);
    return this.program.account.user.fetch(userPDA);
  }

  async getIntent(userPDA: web3.PublicKey, intentId: Buffer) {
    const [intentPDA] = this.getIntentPDA(userPDA, intentId);
    return this.program.account.intent.fetch(intentPDA);
  }

  async getPosition(userPDA: web3.PublicKey, marketId: Buffer) {
    const [positionPDA] = this.getPositionPDA(userPDA, marketId);
    try {
      return await this.program.account.position.fetch(positionPDA);
    } catch {
      return null;
    }
  }

  async getCopyPolicy(follower: web3.PublicKey) {
    const [copyPolicyPDA] = this.getCopyPolicyPDA(follower);
    try {
      return await this.program.account.copyPolicy.fetch(copyPolicyPDA);
    } catch {
      return null;
    }
  }

  async getVaultBalance(userPDA: web3.PublicKey): Promise<number> {
    const [vaultPDA] = this.getVaultPDA(userPDA);
    try {
      const account = await this.provider.connection.getTokenAccountBalance(vaultPDA);
      return Number(account.value.amount);
    } catch {
      return 0;
    }
  }
}

// Helper functions
export function encodeIntentId(id: string): Buffer {
  return encodeHexToFixedBuffer(id, 16);
}

export function encodeMarketId(id: string): Buffer {
  return encodeHexToFixedBuffer(id, 32);
}

export function encodeTxRef(ref: string): Buffer {
  return encodeHexToFixedBuffer(ref, 64);
}

export function encodeLeaderTradeRef(ref: string): Buffer {
  return encodeHexToFixedBuffer(ref, 32);
}

function encodeHexToFixedBuffer(input: string, byteLength: number): Buffer {
  const buf = Buffer.alloc(byteLength);
  if (!input) return buf;
  const hex = input.replace(/^0x/i, '').replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]*$/.test(hex)) {
    throw new Error('Invalid hex/uuid string');
  }
  const slice = hex.slice(0, byteLength * 2).padEnd(byteLength * 2, '0');
  buf.write(slice, 'hex');
  return buf;
}

