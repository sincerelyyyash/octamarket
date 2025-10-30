import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { OctamarketClient, encodeIntentId, encodeMarketId, encodeTxRef, encodeLeaderTradeRef } from '@repo/solana-program';
import type { Logger } from 'winston';
import { getSolanaConfig } from './config.js';

export class SolanaSettlement {
  private client: OctamarketClient;
  private relayer: Keypair;
  private connection: Connection;
  
  constructor(private logger: Logger) {
    const config = getSolanaConfig();
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.relayer = Keypair.fromSecretKey(bs58.decode(config.relayerPrivateKey));
    
    this.client = OctamarketClient.create(this.connection, {
      publicKey: this.relayer.publicKey,
      signTransaction: async (tx: Transaction) => {
        tx.partialSign(this.relayer);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        txs.forEach(tx => tx.partialSign(this.relayer));
        return txs;
      },
    });
  }

  /**
   * Settle a fill on-chain after venue execution
   */
  async settleFill(params: {
    intentId: string;
    userOwner: string; // User wallet address (hex string or base58)
    marketId: string;
    venue: 'KALSHI' | 'POLYMARKET';
    filledQuantity: number;
    avgPrice: number; // Scaled by 1e6
    txRef: string; // Venue transaction reference
  }): Promise<{ signature: string; intentPda: string; positionPda: string }> {
    try {
      const intentIdBuf = encodeIntentId(params.intentId);
      const marketIdBuf = encodeMarketId(params.marketId);
      const txRefBuf = encodeTxRef(params.txRef);
      const userOwnerPubkey = new PublicKey(params.userOwner);
      
      const venue = params.venue === 'KALSHI' ? { kalshi: {} } : { polymarket: {} };
      
      const tx = await this.client.settleFill(
        this.relayer.publicKey,
        userOwnerPubkey,
        intentIdBuf,
        marketIdBuf,
        venue,
        params.filledQuantity,
        params.avgPrice,
        txRefBuf,
        getSolanaConfig().usdcMint
      );
      
      tx.feePayer = this.relayer.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(this.relayer);
      
      const signature = await this.connection.sendRawTransaction(tx.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const [userPda] = this.client.getUserPDA(userOwnerPubkey);
      const [intentPda] = this.client.getIntentPDA(userPda, intentIdBuf);
      const [positionPda] = this.client.getPositionPDA(userPda, marketIdBuf);
      
      this.logger.info('Settled fill on-chain', {
        intentId: params.intentId,
        signature,
        intentPda: intentPda.toBase58(),
        positionPda: positionPda.toBase58(),
      });
      
      return {
        signature,
        intentPda: intentPda.toBase58(),
        positionPda: positionPda.toBase58(),
      };
    } catch (error: any) {
      this.logger.error('Failed to settle fill on-chain', {
        intentId: params.intentId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Open a copy intent on-chain (relayer-signed, no follower signature needed)
   */
  async openCopyIntent(params: {
    follower: string; // Follower wallet address
    leaderTradeRef: string; // Reference to leader's trade
    marketId: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    priceCap: number; // Scaled by 1e6
  }): Promise<{ signature: string; copyIntentPda: string }> {
    try {
      const leaderTradeRefBuf = encodeLeaderTradeRef(params.leaderTradeRef);
      const marketIdBuf = encodeMarketId(params.marketId);
      const followerPubkey = new PublicKey(params.follower);
      
      const side = params.side === 'BUY' ? { buy: {} } : { sell: {} };
      
      const tx = await this.client.openCopyIntent(
        this.relayer.publicKey,
        followerPubkey,
        leaderTradeRefBuf,
        marketIdBuf,
        side,
        params.quantity,
        params.priceCap
      );
      
      tx.feePayer = this.relayer.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(this.relayer);
      
      const signature = await this.connection.sendRawTransaction(tx.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const [copyIntentPda] = this.client.getCopyIntentPDA(followerPubkey, leaderTradeRefBuf);
      
      this.logger.info('Opened copy intent on-chain', {
        follower: params.follower,
        leaderTradeRef: params.leaderTradeRef,
        signature,
        copyIntentPda: copyIntentPda.toBase58(),
      });
      
      return {
        signature,
        copyIntentPda: copyIntentPda.toBase58(),
      };
    } catch (error: any) {
      this.logger.error('Failed to open copy intent on-chain', {
        follower: params.follower,
        leaderTradeRef: params.leaderTradeRef,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Settle a copy fill on-chain after venue execution
   */
  async settleFillCopy(params: {
    follower: string; // Follower wallet address
    leaderTradeRef: string;
    marketId: string;
    venue: 'KALSHI' | 'POLYMARKET';
    filledQuantity: number;
    avgPrice: number; // Scaled by 1e6
    txRef: string; // Venue transaction reference
  }): Promise<{ signature: string; copyIntentPda: string; positionPda: string }> {
    try {
      const leaderTradeRefBuf = encodeLeaderTradeRef(params.leaderTradeRef);
      const marketIdBuf = encodeMarketId(params.marketId);
      const txRefBuf = encodeTxRef(params.txRef);
      const followerPubkey = new PublicKey(params.follower);
      
      const venue = params.venue === 'KALSHI' ? { kalshi: {} } : { polymarket: {} };
      
      const tx = await this.client.settleFillCopy(
        this.relayer.publicKey,
        followerPubkey,
        leaderTradeRefBuf,
        marketIdBuf,
        venue,
        params.filledQuantity,
        params.avgPrice,
        txRefBuf,
        getSolanaConfig().usdcMint
      );
      
      tx.feePayer = this.relayer.publicKey;
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(this.relayer);
      
      const signature = await this.connection.sendRawTransaction(tx.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const [userPda] = this.client.getUserPDA(followerPubkey);
      const [copyIntentPda] = this.client.getCopyIntentPDA(followerPubkey, leaderTradeRefBuf);
      const [positionPda] = this.client.getPositionPDA(userPda, marketIdBuf);
      
      this.logger.info('Settled copy fill on-chain', {
        follower: params.follower,
        leaderTradeRef: params.leaderTradeRef,
        signature,
        copyIntentPda: copyIntentPda.toBase58(),
        positionPda: positionPda.toBase58(),
      });
      
      return {
        signature,
        copyIntentPda: copyIntentPda.toBase58(),
        positionPda: positionPda.toBase58(),
      };
    } catch (error: any) {
      this.logger.error('Failed to settle copy fill on-chain', {
        follower: params.follower,
        leaderTradeRef: params.leaderTradeRef,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get vault balance for a user
   */
  async getVaultBalance(userOwner: string): Promise<number> {
    try {
      const userOwnerPubkey = new PublicKey(userOwner);
      const [userPda] = this.client.getUserPDA(userOwnerPubkey);
      const balance = await this.client.getVaultBalance(userPda);
      return balance;
    } catch (error: any) {
      this.logger.warn('Failed to get vault balance', {
        userOwner,
        error: error.message,
      });
      return 0;
    }
  }
}

