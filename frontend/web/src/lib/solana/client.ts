// Commented out - Frontend should not import from backend packages
// Frontend and backend are separate services and should not share code directly
// If Solana client functionality is needed in the frontend, it should be implemented
// independently or use the backend API instead

/*
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { OctamarketClient } from '@repo/solana-program';
import { SOLANA_RPC_URL, PROGRAM_ID, USDC_MINT } from './config';

export class SolanaClientWrapper {
  private connection: Connection;
  private client: OctamarketClient | null = null;

  constructor() {
    this.connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  }

  initializeClient(wallet: any) {
    this.client = OctamarketClient.create(this.connection, wallet);
    return this.client;
  }

  getConnection() {
    return this.connection;
  }

  async initUser(ownerPublicKey: PublicKey): Promise<Transaction> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initializeClient first.');
    }
    return await this.client.initUser(ownerPublicKey);
  }

  async openIntent(
    ownerPublicKey: PublicKey,
    intentId: Buffer,
    marketId: Buffer,
    side: { buy: {} } | { sell: {} },
    quantity: number,
    maxPrice: number,
    expiry: number
  ): Promise<Transaction> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initializeClient first.');
    }
    return await this.client.openIntent(
      ownerPublicKey,
      intentId,
      marketId,
      side,
      quantity,
      maxPrice,
      expiry,
      USDC_MINT
    );
  }

  async cancelIntent(
    ownerPublicKey: PublicKey,
    intentId: Buffer
  ): Promise<Transaction> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initializeClient first.');
    }
    return await this.client.cancelIntent(ownerPublicKey, intentId, USDC_MINT);
  }

  async fundEscrow(
    ownerPublicKey: PublicKey,
    amount: number
  ): Promise<Transaction> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initializeClient first.');
    }
    return await this.client.fundEscrow(ownerPublicKey, amount, USDC_MINT);
  }

  async withdrawEscrow(
    ownerPublicKey: PublicKey,
    amount: number
  ): Promise<Transaction> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initializeClient first.');
    }
    return await this.client.withdrawEscrow(ownerPublicKey, amount, USDC_MINT);
  }

  // Helper to check if user PDA exists
  async checkUserExists(ownerPublicKey: PublicKey): Promise<boolean> {
    if (!this.client) {
      throw new Error('Client not initialized. Call initializeClient first.');
    }
    try {
      const [userPDA] = this.client.getUserPDA(ownerPublicKey);
      const accountInfo = await this.connection.getAccountInfo(userPDA);
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  }

  // Helper to get balance
  async getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }
}

// Singleton instance
export const solanaClient = new SolanaClientWrapper();
*/

