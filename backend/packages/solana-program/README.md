# Octamarket Solana Program

This package contains the Anchor program for on-chain trade intents, escrow, and copy-trading for Octamarket.

## Overview

The Solana program makes balances, trade intents, and copy-trading permissions on-chain. Users sign transactions to open intents with USDC escrow; the backend execution engine settles fills back on-chain after executing on Kalshi/Polymarket.

Protocol fees: A 0.5% protocol fee (50 bps) is charged on the actual fill notional during settlement. The fee is deducted from the user's escrow and transferred to the program treasury SPL token account for the given mint. Cancels do not incur fees.

## Program Structure

### PDAs (Program Derived Addresses)
- `user_pda`: User registry by wallet (`["user", owner]`)
- `vault_pda`: USDC escrow vault per user (`["vault", user_pda]`)
- `intent_pda`: Trade intent state (`["intent", user_pda, intent_id]`)
- `position_pda`: Cumulative position per market (`["position", user_pda, market_id]`)
- `copy_policy_pda`: Copy-trading policy (`["copy_policy", follower]`)
- `copy_intent_pda`: Copy trade intent (`["copy_intent", follower, leader_trade_ref]`)

### Instructions
- `init_user`: Initialize user PDA
- `open_intent`: Open trade intent with USDC escrow
- `cancel_intent`: Cancel intent and refund escrow
- `settle_fill`: Settle fill after off-chain execution (relayer-signed)
- `set_copy_policy`: Set copy-trading policy and caps
- `fund_escrow`: Deposit USDC into escrow vault
- `withdraw_escrow`: Withdraw USDC from escrow vault
- `open_copy_intent`: Open copy trade intent (relayer-signed, zero follower interaction)
- `settle_fill_copy`: Settle copy trade fill (relayer-signed)

Fee routing on settlement
- During `settle_fill` and `settle_fill_copy`, the program transfers the protocol fee from the user's vault to the treasury token account, then refunds any remaining escrow to the user.
- Treasury accounts are program PDAs:
  - `treasury_bump`: `['treasury_bump']`
  - `treasury` (SPL Token Account): `['treasury', usdc_mint]`, authority = `treasury_bump`

### Events
- `IntentOpened`: Intent created with escrow
- `IntentCancelled`: Intent cancelled with refund
- `FillSettled`: Fill settled with venue/price details
- `CopyPolicySet`: Copy policy updated
- `CopyIntentOpened`: Copy intent created
- `CopyFillSettled`: Copy fill settled

## Building

```bash
cd octamarket
anchor build
```

## Deploying

### Devnet
```bash
npm run deploy:devnet
```

### Mainnet
```bash
npm run deploy:mainnet
```

## TypeScript Client

The TypeScript client is exported from `src/client.ts`:

```typescript
import { OctamarketClient, PROGRAM_ID } from '@opinion-markets/solana-program';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.generate();
const client = OctamarketClient.create(connection, wallet);

// Initialize user
const tx = await client.initUser(wallet.publicKey);
await wallet.signTransaction(tx);
await connection.sendTransaction(tx, [wallet]);

// Open intent
const intentId = Buffer.from('...'); // 16 bytes
const marketId = Buffer.from('...'); // 32 bytes
const usdcMint = new PublicKey('...');
const tx = await client.openIntent(
  wallet.publicKey,
  intentId,
  marketId,
  { buy: {} },
  10, // quantity
  650000, // max price (0.65 scaled by 1e6)
  Math.floor(Date.now() / 1000) + 3600, // expiry (1 hour)
  usdcMint
);
```

## Integration

### Server
- Build unsigned transactions for user actions (init, open_intent, cancel_intent, set_copy_policy)
- Return base64-encoded transactions to client for wallet signing

### Indexer
- Listen to program logs and events via WebSocket
- Mirror on-chain state to Postgres (intents, positions, copy policies)

### Execution Engine
- After venue execution, call `settle_fill` or `settle_fill_copy` with relayer keypair
- Submit settlement attestations on-chain

## Configuration

### Devnet
- RPC: `https://api.devnet.solana.com`
- USDC Mint: Use devnet USDC mock mint
- Program ID: `DSzcxNHsezokjETdk9ymJYvR27bGS876g2EqoVxQraQE`

### Mainnet-beta
- RPC: `https://api.mainnet-beta.solana.com` (or use a dedicated RPC provider)
- USDC Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Program ID: TBD after mainnet deployment

## Security

- Private keys and signing are isolated in a relayer service (for settle_fill/open_copy_intent)
- Users maintain custody of funds in their wallets; escrow only happens when opening intents
- All on-chain state transitions are logged as events for auditability

## Copy Trading Flow

1. Follower sets copy policy on-chain (one-time, signed by follower)
2. Follower funds escrow vault (one-time, signed by follower)
3. Leader trade detected by indexer
4. Engine computes follower allocations and calls `open_copy_intent` (relayer-signed, no follower signature)
5. Engine executes off-chain
6. Engine calls `settle_fill_copy` (relayer-signed)

This allows zero-latency copy trading without follower wallet prompts at execution time.

