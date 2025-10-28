import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const app = express();
app.use(express.json());

const PORT = process.env.SIGNER_PORT || 8081;
const SIGNER_TOKEN = process.env.SIGNER_TOKEN || '';
const IP_ALLOWLIST = (process.env.SIGNER_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);


const KALSHI_API_KEY = process.env.KALSHI_API_KEY || '';
const KALSHI_PRIVATE_KEY_PEM = process.env.KALSHI_PRIVATE_KEY_PEM || '';
const POLYMARKET_PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || '';
const POLYMARKET_CHAIN_ID = parseInt(process.env.POLYMARKET_CHAIN_ID || '137', 10);
const POLYMARKET_CLOB_ENDPOINT = process.env.POLYMARKET_CLOB_ENDPOINT || 'https://clob.polymarket.com';

// Solana config
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_USDC_MINT = process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_TREASURY_SECRET = process.env.SOLANA_TREASURY_SECRET || '';

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
let treasuryKeypair: Keypair | null = null;
try {
  if (SOLANA_TREASURY_SECRET) {
    treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SOLANA_TREASURY_SECRET)));
  }
} catch {
  // Invalid format provided; disable treasury to avoid crashing
  treasuryKeypair = null;
}

// Simple auth/IP allowlist middleware
const authorize = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // In local development, if no SIGNER_TOKEN is configured, allow requests
  if ((!SIGNER_TOKEN || SIGNER_TOKEN.length === 0) && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
    return next();
  }
  const header = req.headers.authorization;
  const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : undefined;
  const xff = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(xff) ? xff[0] : xff;
  const remoteIp = (forwarded ? String(forwarded) : '').split(',')[0]?.trim() || req.socket.remoteAddress || '';

  const tokenOk = !!SIGNER_TOKEN && bearer === SIGNER_TOKEN;
  const reqIp = req.ip || '';
  const ipOk = IP_ALLOWLIST.length > 0 && (IP_ALLOWLIST.includes(remoteIp) || IP_ALLOWLIST.includes(reqIp));

  if (tokenOk || ipOk) return next();

  return res.status(401).json({ error: 'Unauthorized' });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Kalshi credentials
app.get('/credentials/kalshi', authorize, (req, res) => {
  if (!KALSHI_API_KEY || !KALSHI_PRIVATE_KEY_PEM) {
    return res.status(500).json({ error: 'Kalshi credentials not configured' });
  }
  res.json({
    apiKey: KALSHI_API_KEY,
    privateKeyPem: KALSHI_PRIVATE_KEY_PEM,
  });
});

// Get Polymarket credentials
app.get('/credentials/polymarket', authorize, (req, res) => {
  if (!POLYMARKET_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Polymarket credentials not configured' });
  }
  res.json({
    privateKey: POLYMARKET_PRIVATE_KEY,
    chainId: POLYMARKET_CHAIN_ID,
    clobEndpoint: POLYMARKET_CLOB_ENDPOINT,
  });
});

// Sign Kalshi request
app.post('/sign/kalshi', authorize, (req, res) => {
  try {
    const { method, path, timestamp } = req.body;
    if (!method || !path || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const message = `${timestamp}${method}${path}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();
    const signature = sign.sign(KALSHI_PRIVATE_KEY_PEM, 'base64');

    res.json({ signature });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sign Polymarket order (EIP-712)
app.post('/sign/polymarket', authorize, async (req, res) => {
  try {
    const { order, chainId } = req.body;
    if (!order) {
      return res.status(400).json({ error: 'Missing order' });
    }

    const wallet = new ethers.Wallet(POLYMARKET_PRIVATE_KEY);

    const domain = {
      name: 'ClobAuthDomain',
      version: '1',
      chainId: chainId || POLYMARKET_CHAIN_ID,
    };

    const types = {
      LimitOrder: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'expiration', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'signatureType', type: 'uint8' },
      ],
    };

    const signature = await wallet.signTypedData(domain, types, order);

    res.json({ signature, address: wallet.address });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Solana USDC transfer from treasury to user for withdrawals
app.post('/solana/withdraw', authorize, async (req, res) => {
  try {
    const { destination, amount } = req.body as { destination: string; amount: string };
    if (!treasuryKeypair) return res.status(500).json({ error: 'Treasury not configured' });
    if (!destination || !amount) return res.status(400).json({ error: 'Missing fields' });

    const mint = new PublicKey(SOLANA_USDC_MINT);
    const dest = new PublicKey(destination);
    const sourceAta = await getAssociatedTokenAddress(mint, treasuryKeypair.publicKey, false);
    const destAta = await getAssociatedTokenAddress(mint, dest, true);

    const ix = createTransferInstruction(
      sourceAta,
      destAta,
      treasuryKeypair.publicKey,
      BigInt(Math.floor(parseFloat(amount) * 1_000_000)),
      [],
      TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(ix);
    tx.feePayer = treasuryKeypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const sig = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);
    res.json({ signature: sig });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Signer service running on port ${PORT}`);
});

