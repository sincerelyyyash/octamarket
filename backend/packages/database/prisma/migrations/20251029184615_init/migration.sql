-- CreateEnum
CREATE TYPE "MarketSource" AS ENUM ('POLYMARKET', 'KALSHI', 'AUGUR', 'THALES', 'OMEN');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MARKET_CREATED', 'MARKET_UPDATED', 'MARKET_RESOLVED', 'PRICE_UPDATE', 'VOLUME_UPDATE', 'LIQUIDITY_UPDATE', 'TRADE_EXECUTED', 'TRADER_UPDATED');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "TradeIntentStatus" AS ENUM ('SUBMITTED', 'FILLED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetSymbol" AS ENUM ('USDC');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'RESERVATION', 'RELEASE', 'TRADE_SETTLEMENT', 'FEE');

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "resolutionDate" TIMESTAMP(3),
    "status" "MarketStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalVolume" DECIMAL(20,8),
    "totalLiquidity" DECIMAL(20,8),
    "participantCount" INTEGER DEFAULT 0,
    "resolvedOutcome" TEXT,
    "resolutionSource" TEXT,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMarket" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "source" "MarketSource" NOT NULL,
    "sourceMarketId" TEXT NOT NULL,
    "tokenId" TEXT,
    "sourceData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOutcome" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "index" INTEGER NOT NULL,
    "currentPrice" DECIMAL(10,8),
    "currentVolume" DECIMAL(20,8),
    "currentLiquidity" DECIMAL(20,8),
    "isWinning" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketEvent" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "source" "MarketSource" NOT NULL,
    "eventType" "EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "source" "MarketSource" NOT NULL,
    "price" DECIMAL(10,8) NOT NULL,
    "volume" DECIMAL(20,8),
    "liquidity" DECIMAL(20,8),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketMapping" (
    "id" TEXT NOT NULL,
    "canonicalMarketId" TEXT NOT NULL,
    "duplicateMarketId" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trader" (
    "id" TEXT NOT NULL,
    "source" "MarketSource" NOT NULL,
    "sourceTraderId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "profileImageUrl" TEXT,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "totalPnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "winRate" DECIMAL(5,4),
    "avgReturn" DECIMAL(10,8),
    "currentRank" INTEGER,
    "bestRank" INTEGER,
    "rankChange" INTEGER DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "firstTradeAt" TIMESTAMP(3),
    "lastTradeAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowCopyTrading" BOOLEAN NOT NULL DEFAULT false,
    "maxFollowers" INTEGER,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "source" "MarketSource" NOT NULL,
    "sourceTradeId" TEXT NOT NULL,
    "marketId" TEXT,
    "sourceMarketId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "outcomeIndex" INTEGER,
    "quantity" DECIMAL(20,8) NOT NULL,
    "price" DECIMAL(10,8) NOT NULL,
    "totalValue" DECIMAL(20,8) NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'EXECUTED',
    "executedAt" TIMESTAMP(3) NOT NULL,
    "realizedPnl" DECIMAL(20,8),
    "unrealizedPnl" DECIMAL(20,8),
    "isCopyTrade" BOOLEAN NOT NULL DEFAULT false,
    "originalTradeId" TEXT,
    "copiedByTraderId" TEXT,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraderFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "autoCopyTrades" BOOLEAN NOT NULL DEFAULT false,
    "maxCopyAmount" DECIMAL(20,8),
    "copyPercentage" DECIMAL(5,4),
    "totalCopiedTrades" INTEGER NOT NULL DEFAULT 0,
    "totalCopiedValue" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "totalCopiedPnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "source" "MarketSource" NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topTraderId" TEXT NOT NULL,
    "topTraderPnl" DECIMAL(20,8) NOT NULL,
    "topTraderVolume" DECIMAL(20,8) NOT NULL,
    "totalTraders" INTEGER NOT NULL,
    "totalVolume" DECIMAL(20,8) NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "avgPnl" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL,
    "source" "MarketSource" NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastBlockNumber" BIGINT,
    "lastEventId" TEXT,
    "lastTradeSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeIntent" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "userId" TEXT,
    "traderId" TEXT,
    "followingId" TEXT,
    "source" "MarketSource" NOT NULL,
    "marketId" TEXT,
    "sourceMarketId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "outcomeIndex" INTEGER,
    "quantity" DECIMAL(20,8) NOT NULL,
    "limitPrice" DECIMAL(10,8),
    "status" "TradeIntentStatus" NOT NULL,
    "venue" TEXT,
    "orderId" TEXT,
    "avgPrice" DECIMAL(10,8),
    "fills" JSONB,
    "reason" TEXT,
    "error" TEXT,
    "submittedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "solanaAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" "AssetSymbol" NOT NULL,
    "available" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" "AssetSymbol" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" "AssetSymbol" NOT NULL,
    "direction" "TransferDirection" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "txSignature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_endDate_idx" ON "Market"("endDate");

-- CreateIndex
CREATE INDEX "Market_category_idx" ON "Market"("category");

-- CreateIndex
CREATE INDEX "SourceMarket_marketId_idx" ON "SourceMarket"("marketId");

-- CreateIndex
CREATE INDEX "SourceMarket_source_idx" ON "SourceMarket"("source");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMarket_source_sourceMarketId_key" ON "SourceMarket"("source", "sourceMarketId");

-- CreateIndex
CREATE INDEX "MarketOutcome_marketId_idx" ON "MarketOutcome"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOutcome_marketId_index_key" ON "MarketOutcome"("marketId", "index");

-- CreateIndex
CREATE INDEX "MarketEvent_marketId_idx" ON "MarketEvent"("marketId");

-- CreateIndex
CREATE INDEX "MarketEvent_source_idx" ON "MarketEvent"("source");

-- CreateIndex
CREATE INDEX "MarketEvent_eventType_idx" ON "MarketEvent"("eventType");

-- CreateIndex
CREATE INDEX "MarketEvent_timestamp_idx" ON "MarketEvent"("timestamp");

-- CreateIndex
CREATE INDEX "PriceHistory_marketId_timestamp_idx" ON "PriceHistory"("marketId", "timestamp");

-- CreateIndex
CREATE INDEX "PriceHistory_source_timestamp_idx" ON "PriceHistory"("source", "timestamp");

-- CreateIndex
CREATE INDEX "PriceHistory_outcomeId_timestamp_idx" ON "PriceHistory"("outcomeId", "timestamp");

-- CreateIndex
CREATE INDEX "MarketMapping_canonicalMarketId_idx" ON "MarketMapping"("canonicalMarketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketMapping_canonicalMarketId_duplicateMarketId_key" ON "MarketMapping"("canonicalMarketId", "duplicateMarketId");

-- CreateIndex
CREATE INDEX "Trader_source_idx" ON "Trader"("source");

-- CreateIndex
CREATE INDEX "Trader_currentRank_idx" ON "Trader"("currentRank");

-- CreateIndex
CREATE INDEX "Trader_totalPnl_idx" ON "Trader"("totalPnl");

-- CreateIndex
CREATE INDEX "Trader_winRate_idx" ON "Trader"("winRate");

-- CreateIndex
CREATE UNIQUE INDEX "Trader_source_sourceTraderId_key" ON "Trader"("source", "sourceTraderId");

-- CreateIndex
CREATE INDEX "Trade_traderId_idx" ON "Trade"("traderId");

-- CreateIndex
CREATE INDEX "Trade_marketId_idx" ON "Trade"("marketId");

-- CreateIndex
CREATE INDEX "Trade_executedAt_idx" ON "Trade"("executedAt");

-- CreateIndex
CREATE INDEX "Trade_source_idx" ON "Trade"("source");

-- CreateIndex
CREATE INDEX "Trade_isCopyTrade_idx" ON "Trade"("isCopyTrade");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_source_sourceTradeId_key" ON "Trade"("source", "sourceTradeId");

-- CreateIndex
CREATE INDEX "TraderFollow_followerId_idx" ON "TraderFollow"("followerId");

-- CreateIndex
CREATE INDEX "TraderFollow_followingId_idx" ON "TraderFollow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "TraderFollow_followerId_followingId_key" ON "TraderFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_source_snapshotDate_idx" ON "LeaderboardSnapshot"("source", "snapshotDate");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_snapshotDate_idx" ON "LeaderboardSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerState_source_key" ON "IndexerState"("source");

-- CreateIndex
CREATE INDEX "IndexerState_source_idx" ON "IndexerState"("source");

-- CreateIndex
CREATE UNIQUE INDEX "TradeIntent_intentId_key" ON "TradeIntent"("intentId");

-- CreateIndex
CREATE INDEX "TradeIntent_status_idx" ON "TradeIntent"("status");

-- CreateIndex
CREATE INDEX "TradeIntent_sourceMarketId_idx" ON "TradeIntent"("sourceMarketId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_solanaAddress_key" ON "Wallet"("solanaAddress");

-- CreateIndex
CREATE INDEX "Account_asset_idx" ON "Account"("asset");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_asset_key" ON "Account"("userId", "asset");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_asset_createdAt_idx" ON "LedgerEntry"("userId", "asset", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_txSignature_key" ON "Transfer"("txSignature");

-- CreateIndex
CREATE INDEX "Transfer_userId_asset_direction_status_idx" ON "Transfer"("userId", "asset", "direction", "status");

-- AddForeignKey
ALTER TABLE "SourceMarket" ADD CONSTRAINT "SourceMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOutcome" ADD CONSTRAINT "MarketOutcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "MarketOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_originalTradeId_fkey" FOREIGN KEY ("originalTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderFollow" ADD CONSTRAINT "TraderFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderFollow" ADD CONSTRAINT "TraderFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "Trader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_topTraderId_fkey" FOREIGN KEY ("topTraderId") REFERENCES "Trader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
