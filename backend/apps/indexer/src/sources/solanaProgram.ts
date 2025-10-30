import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BorshCoder } from '@coral-xyz/anchor';
import { OctamarketClient, IDL } from '@repo/solana-program';
import { prisma } from '@repo/database';
import { EventType } from '@repo/database';
import type { DataSource, MarketEventData, SourceConfig } from '../types/index.js';
import { DataSourceError } from '../types/index.js';
import { createSourceLogger } from '../utils/logger.js';

interface SolanaSourceConfig extends SourceConfig {
  programId: string;
  rpcUrl: string;
  wsUrl: string;
}

export class SolanaProgramSource implements DataSource {
  readonly name = 'SOLANA' as const;
  readonly isActive: boolean;
  
  private connection: Connection;
  private wsConnection?: Connection;
  private client: OctamarketClient;
  private subscriptionId?: number;
  private readonly logger = createSourceLogger('solana-program');
  private updateCallback?: (event: MarketEventData) => void;
  private coder: BorshCoder;
  private programId: PublicKey;

  constructor(private config: SolanaSourceConfig) {
    this.isActive = config.enabled;
    this.programId = new PublicKey(config.programId);
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.wsConnection = new Connection(config.wsUrl, 'confirmed');
    
    // Create dummy wallet for read-only operations
    const wallet = {
      publicKey: PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    
    const provider = new AnchorProvider(this.connection, wallet, { commitment: 'confirmed' });
    const program = new Program(IDL as any, this.programId, provider);
    this.client = new OctamarketClient(program, provider);
    this.coder = new BorshCoder(IDL as any);
  }

  async initialize(): Promise<void> {
    if (!this.isActive) {
      this.logger.info('Solana program source is disabled');
      return;
    }

    this.logger.info('Initializing Solana program source', {
      programId: this.programId.toBase58(),
      rpcUrl: this.config.rpcUrl,
      wsUrl: this.config.wsUrl,
    });

    try {
      // Test RPC connection
      const version = await this.connection.getVersion();
      this.logger.info('Solana RPC connection successful', { version });
      
      // Verify program exists
      const programInfo = await this.connection.getAccountInfo(this.programId);
      if (!programInfo) {
        throw new Error(`Program not found: ${this.programId.toBase58()}`);
      }
      
      this.logger.info('Solana program verified', {
        programId: this.programId.toBase58(),
        executable: programInfo.executable,
      });
    } catch (error) {
      throw new DataSourceError(
        'Failed to connect to Solana RPC',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async startPolling(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Starting Solana program log subscription');
    
    try {
      // Subscribe to program logs
      this.subscriptionId = this.wsConnection!.onLogs(
        this.programId,
        async (logs, ctx) => {
          try {
            await this.handleProgramLogs(logs, ctx);
          } catch (error) {
            this.logger.error('Error handling program logs', {
              error: error instanceof Error ? error.message : String(error),
              signature: logs.signature,
            });
          }
        },
        'confirmed'
      );

      this.logger.info('Successfully subscribed to program logs', {
        subscriptionId: this.subscriptionId,
      });

      // Also do an initial sync of recent transactions
      await this.syncRecentTransactions();
    } catch (error) {
      this.logger.error('Failed to subscribe to program logs', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stopPolling(): Promise<void> {
    if (this.subscriptionId !== undefined) {
      await this.wsConnection?.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = undefined;
      this.logger.info('Stopped Solana program log subscription');
    }
  }

  private async handleProgramLogs(logs: any, ctx: any): Promise<void> {
    const { signature, err } = logs;
    
    if (err) {
      this.logger.debug('Transaction failed', { signature, error: err });
      return;
    }

    this.logger.debug('Processing transaction', { signature, slot: ctx.slot });

    try {
      // Fetch full transaction details
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta) {
        this.logger.debug('Transaction not found or no meta', { signature });
        return;
      }

      // Parse instruction data and events
      const events = this.parseTransactionEvents(tx);
      
      for (const event of events) {
        await this.processEvent(event, signature);
      }
    } catch (error) {
      this.logger.error('Error processing transaction', {
        signature,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private parseTransactionEvents(tx: any): Array<{ name: string; data: any }> {
    const events: Array<{ name: string; data: any }> = [];
    
    if (!tx.meta?.innerInstructions) {
      return events;
    }

    // Look for program logs that contain events
    const logs = tx.meta.logMessages || [];
    
    for (const log of logs) {
      try {
        // Anchor events are logged as base64-encoded data
        if (log.includes('Program log:') && log.includes('event:')) {
          const match = log.match(/Program log: event: (.+)/);
          if (match && match[1]) {
            const eventData = match[1];
            // Parse event based on IDL
            const decoded = this.decodeEvent(eventData);
            if (decoded) {
              events.push(decoded);
            }
          }
        }
      } catch (error) {
        this.logger.debug('Failed to parse event from log', {
          log,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return events;
  }

  private decodeEvent(eventData: string): { name: string; data: any } | null {
    try {
      // Anchor event format: base64 encoded with discriminator
      const buffer = Buffer.from(eventData, 'base64');
      
      // Try to decode each event type
      const eventTypes = ['IntentOpened', 'IntentCancelled', 'FillSettled', 'CopyPolicySet', 'CopyIntentOpened', 'CopyFillSettled'];
      
      for (const eventName of eventTypes) {
        try {
          const decoded = this.coder.events.decode(eventName, buffer);
          if (decoded) {
            return { name: eventName, data: decoded };
          }
        } catch {
          // Try next event type
          continue;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async processEvent(event: { name: string; data: any }, signature: string): Promise<void> {
    this.logger.info('Processing event', { 
      eventName: event.name, 
      signature,
      data: JSON.stringify(event.data).substring(0, 200),
    });

    try {
      switch (event.name) {
        case 'IntentOpened':
          await this.handleIntentOpened(event.data, signature);
          break;
        case 'IntentCancelled':
          await this.handleIntentCancelled(event.data, signature);
          break;
        case 'FillSettled':
          await this.handleFillSettled(event.data, signature);
          break;
        case 'CopyPolicySet':
          await this.handleCopyPolicySet(event.data, signature);
          break;
        case 'CopyIntentOpened':
          await this.handleCopyIntentOpened(event.data, signature);
          break;
        case 'CopyFillSettled':
          await this.handleCopyFillSettled(event.data, signature);
          break;
        default:
          this.logger.debug('Unknown event type', { eventName: event.name });
      }
    } catch (error) {
      this.logger.error('Error processing event', {
        eventName: event.name,
        signature,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleIntentOpened(data: any, signature: string): Promise<void> {
    const { user, intentId, marketId, side, quantity, maxPrice, escrowAmount } = data;

    const intentIdStr = Buffer.from(intentId).toString('hex');
    const marketIdStr = Buffer.from(marketId).toString('hex');

    const [intentPda] = this.client.getIntentPDA(user, Buffer.from(intentId));

    this.logger.info('Intent opened', {
      intentId: intentIdStr,
      marketId: marketIdStr,
      side: side.buy ? 'BUY' : 'SELL',
      quantity: quantity.toString(),
      maxPrice: maxPrice.toString(),
      intentPda: intentPda.toBase58(),
    });

    await prisma.tradeIntent.upsert({
      where: { intentId: intentIdStr },
      update: {
        intentPda: intentPda.toBase58(),
        onChainState: 'OPEN',
        escrowAmount,
        updatedAt: new Date(),
      },
      create: {
        intentId: intentIdStr,
        userId: user.toBase58(),
        marketId: marketIdStr,
        intentPda: intentPda.toBase58(),
        side: side.buy ? 'BUY' : 'SELL',
        quantity,
        limitPrice: Number(maxPrice) / 1_000_000,
        onChainState: 'OPEN',
        status: 'PENDING',
        escrowAmount,
      },
    });

    if (this.updateCallback) {
      this.updateCallback({
        type: EventType.CREATED,
        timestamp: new Date(),
        data: {
          intentId: intentIdStr,
          marketId: marketIdStr,
          intentPda: intentPda.toBase58(),
        },
      });
    }
  }

  private async handleIntentCancelled(data: any, signature: string): Promise<void> {
    const { user, intentId } = data;
    const intentIdStr = Buffer.from(intentId).toString('hex');
    const [intentPda] = this.client.getIntentPDA(user, Buffer.from(intentId));
    
    this.logger.info('Intent cancelled', {
      intentId: intentIdStr,
      intentPda: intentPda.toBase58(),
    });

    await prisma.tradeIntent.update({
      where: { intentId: intentIdStr },
      data: {
        onChainState: 'CANCELLED',
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    if (this.updateCallback) {
      this.updateCallback({
        type: EventType.UPDATED,
        timestamp: new Date(),
        data: {
          intentId: intentIdStr,
          status: 'CANCELLED',
        },
      });
    }
  }

  private async handleFillSettled(data: any, signature: string): Promise<void> {
    const { user, intentId, marketId, venue, filledQuantity, avgPrice, txRef } = data;

    const intentIdStr = Buffer.from(intentId).toString('hex');
    const marketIdStr = Buffer.from(marketId).toString('hex');
    const txRefStr = Buffer.from(txRef).toString('hex');
    const [intentPda] = this.client.getIntentPDA(user, Buffer.from(intentId));
    const [positionPda] = this.client.getPositionPDA(user, Buffer.from(marketId));
    
    this.logger.info('Fill settled', {
      intentId: intentIdStr,
      marketId: marketIdStr,
      filledQuantity: filledQuantity.toString(),
      avgPrice: avgPrice.toString(),
      venue: venue.kalshi ? 'KALSHI' : 'POLYMARKET',
    });

    // Update intent
    await prisma.tradeIntent.update({
      where: { intentId: intentIdStr },
      data: {
        onChainState: 'FILLED',
        status: 'FILLED',
        settlementSig: signature,
        updatedAt: new Date(),
      },
    });

    // Create or update position
    await prisma.onChainPosition.upsert({
      where: {
        userPda_marketId: {
          userPda: user.toBase58(),
          marketId: marketIdStr,
        },
      },
      update: {
        positionPda: positionPda.toBase58(),
        quantity: filledQuantity,
        avgPrice: Number(avgPrice) / 1_000_000,
        updatedAt: new Date(),
      },
      create: {
        userPda: user.toBase58(),
        marketId: marketIdStr,
        positionPda: positionPda.toBase58(),
        quantity: filledQuantity,
        avgPrice: Number(avgPrice) / 1_000_000,
      },
    });

    // Create trade record
    await prisma.trade.create({
      data: {
        userId: user.toBase58(),
        marketId: marketIdStr,
        intentPda: intentPda.toBase58(),
        positionPda: positionPda.toBase58(),
        source: venue.kalshi ? 'KALSHI' : 'POLYMARKET',
        side: 'BUY', // TODO: Get from intent
        quantity: filledQuantity,
        price: Number(avgPrice) / 1_000_000,
        status: 'SETTLED',
        txSignature: signature,
        settlementRef: txRefStr,
      },
    });

    if (this.updateCallback) {
      this.updateCallback({
        type: EventType.UPDATED,
        timestamp: new Date(),
        data: {
          intentId: intentIdStr,
          status: 'FILLED',
          signature,
        },
      });
    }
  }

  private async handleCopyPolicySet(data: any, signature: string): Promise<void> {
    const { follower, copyPercentage, maxCopyAmount, maxDailyAmount, expiry } = data;
    const [copyPolicyPda] = this.client.getCopyPolicyPDA(follower);
    
    this.logger.info('Copy policy set', {
      follower: follower.toBase58(),
      copyPercentage,
      maxCopyAmount: maxCopyAmount.toString(),
      maxDailyAmount: maxDailyAmount.toString(),
    });

    await prisma.onChainCopyPolicy.upsert({
      where: { followerAddress: follower.toBase58() },
      update: {
        policyPda: copyPolicyPda.toBase58(),
        copyPercentage,
        maxCopyAmount,
        maxDailyAmount,
        expiry: new Date(expiry * 1000),
        updatedAt: new Date(),
      },
      create: {
        followerAddress: follower.toBase58(),
        policyPda: copyPolicyPda.toBase58(),
        copyPercentage,
        maxCopyAmount,
        maxDailyAmount,
        expiry: new Date(expiry * 1000),
      },
    });

    if (this.updateCallback) {
      this.updateCallback({
        type: EventType.CREATED,
        timestamp: new Date(),
        data: {
          follower: follower.toBase58(),
          copyPolicyPda: copyPolicyPda.toBase58(),
        },
      });
    }
  }

  private async handleCopyIntentOpened(data: any, signature: string): Promise<void> {
    const { follower, leaderTradeRef, marketId, side, quantity, priceCap, escrowAmount } = data;

    const leaderTradeRefStr = Buffer.from(leaderTradeRef).toString('hex');
    const marketIdStr = Buffer.from(marketId).toString('hex');
    
    this.logger.info('Copy intent opened', {
      follower: follower.toBase58(),
      leaderTradeRef: leaderTradeRefStr,
      marketId: marketIdStr,
      quantity: quantity.toString(),
    });

    const [copyIntentPda] = this.client.getCopyIntentPDA(
      follower,
      Buffer.from(leaderTradeRef)
    );

    await prisma.onChainCopyIntent.create({
      data: {
        followerAddress: follower.toBase58(),
        copyIntentPda: copyIntentPda.toBase58(),
        leaderTradeRef: leaderTradeRefStr,
        marketId: marketIdStr,
        side: side.buy ? 'BUY' : 'SELL',
        quantity,
        priceCap: Number(priceCap) / 1_000_000,
        escrowAmount,
        status: 'OPEN',
      },
    });

    if (this.updateCallback) {
      this.updateCallback({
        type: EventType.CREATED,
        timestamp: new Date(),
        data: {
          follower: follower.toBase58(),
          copyIntentPda: copyIntentPda.toBase58(),
          leaderTradeRef: leaderTradeRefStr,
        },
      });
    }
  }

  private async handleCopyFillSettled(data: any, signature: string): Promise<void> {
    const { follower, leaderTradeRef, marketId, venue, filledQuantity, avgPrice, txRef } = data;
    const [copyIntentPda] = this.client.getCopyIntentPDA(
      follower,
      Buffer.from(leaderTradeRef)
    );
    const [positionPda] = this.client.getPositionPDA(follower, Buffer.from(marketId));

    const leaderTradeRefStr = Buffer.from(leaderTradeRef).toString('hex');
    const marketIdStr = Buffer.from(marketId).toString('hex');
    const txRefStr = Buffer.from(txRef).toString('hex');
    
    this.logger.info('Copy fill settled', {
      follower: follower.toBase58(),
      leaderTradeRef: leaderTradeRefStr,
      filledQuantity: filledQuantity.toString(),
      avgPrice: avgPrice.toString(),
    });

    // Update copy intent
    await prisma.onChainCopyIntent.update({
      where: {
        followerAddress_leaderTradeRef: {
          followerAddress: follower.toBase58(),
          leaderTradeRef: leaderTradeRefStr,
        },
      },
      data: {
        status: 'FILLED',
        settlementSig: signature,
        updatedAt: new Date(),
      },
    });

    // Create trade record
    await prisma.trade.create({
      data: {
        userId: follower.toBase58(),
        marketId: marketIdStr,
        copyIntentPda: copyIntentPda.toBase58(),
        positionPda: positionPda.toBase58(),
        source: venue.kalshi ? 'KALSHI' : 'POLYMARKET',
        side: 'BUY', // TODO: Get from copy intent
        quantity: filledQuantity,
        price: Number(avgPrice) / 1_000_000,
        status: 'SETTLED',
        txSignature: signature,
        settlementRef: txRefStr,
        isCopyTrade: true,
      },
    });

    if (this.updateCallback) {
      this.updateCallback({
        type: EventType.UPDATED,
        timestamp: new Date(),
        data: {
          follower: follower.toBase58(),
          leaderTradeRef: leaderTradeRefStr,
          status: 'FILLED',
          signature,
        },
      });
    }
  }

  private async syncRecentTransactions(): Promise<void> {
    this.logger.info('Syncing recent transactions');
    
    try {
      // Get recent signatures for the program
      const signatures = await this.connection.getSignaturesForAddress(
        this.programId,
        { limit: 100 },
        'confirmed'
      );

      this.logger.info(`Found ${signatures.length} recent transactions`);

      // Process each transaction
      for (const sig of signatures) {
        if (sig.err) continue;
        
        try {
          const tx = await this.connection.getTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (tx && tx.meta) {
            const events = this.parseTransactionEvents(tx);
            for (const event of events) {
              await this.processEvent(event, sig.signature);
            }
          }
        } catch (error) {
          this.logger.debug('Error processing signature during sync', {
            signature: sig.signature,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Recent transactions sync complete');
    } catch (error) {
      this.logger.error('Error syncing recent transactions', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getMarkets(): Promise<any[]> {
    // Solana program doesn't directly manage market data
    // Markets are sourced from Polymarket/Kalshi
    return [];
  }

  async getPrices(marketId: string): Promise<any[]> {
    // Prices are sourced from venues
    return [];
  }

  onUpdate(callback: (event: MarketEventData) => void): void {
    this.updateCallback = callback;
  }

  async shutdown(): Promise<void> {
    await this.stopPolling();
    this.logger.info('Solana program source shut down');
  }
}

