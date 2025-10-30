import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export interface SIWSRequest extends Request {
  solanaWallet?: {
    address: string;
    publicKey: PublicKey;
  };
}

/**
 * SIWS (Sign-In With Solana) authentication middleware
 * 
 * Expects either:
 * - Authorization: Bearer <JWT> (existing auth)
 * - X-Solana-Wallet: <wallet address>
 * - X-Solana-Signature: <base58 signature>
 * - X-Solana-Message: <message that was signed>
 */
export const authenticateSolana = async (
  req: SIWSRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const walletAddress = req.headers['x-solana-wallet'] as string;
    const signature = req.headers['x-solana-signature'] as string;
    const message = req.headers['x-solana-message'] as string;

    if (!walletAddress || !signature || !message) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Missing Solana auth headers',
          code: 'MISSING_SOLANA_AUTH',
        },
      });
      return;
    }

    // Verify signature
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid signature',
          code: 'INVALID_SIGNATURE',
        },
      });
      return;
    }

    // Verify message format and timestamp (prevent replay attacks)
    const messageData = parseSIWSMessage(message);
    if (!messageData) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid message format',
          code: 'INVALID_MESSAGE_FORMAT',
        },
      });
      return;
    }

    // Check timestamp (message must be within 5 minutes)
    const now = Date.now();
    const messageTime = new Date(messageData.timestamp).getTime();
    if (Math.abs(now - messageTime) > 5 * 60 * 1000) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Message expired',
          code: 'MESSAGE_EXPIRED',
        },
      });
      return;
    }

    // Attach wallet info to request
    req.solanaWallet = {
      address: walletAddress,
      publicKey,
    };

    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Solana authentication failed',
        code: 'SOLANA_AUTH_FAILED',
        details: error.message,
      },
    });
  }
};

/**
 * Optional Solana auth - continues even if auth fails
 */
export const optionalAuthenticateSolana = async (
  req: SIWSRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const walletAddress = req.headers['x-solana-wallet'] as string;
  const signature = req.headers['x-solana-signature'] as string;
  const message = req.headers['x-solana-message'] as string;

  if (walletAddress && signature && message) {
    try {
      const publicKey = new PublicKey(walletAddress);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );

      if (isValid) {
        const messageData = parseSIWSMessage(message);
        if (messageData) {
          const now = Date.now();
          const messageTime = new Date(messageData.timestamp).getTime();
          if (Math.abs(now - messageTime) <= 5 * 60 * 1000) {
            req.solanaWallet = {
              address: walletAddress,
              publicKey,
            };
          }
        }
      }
    } catch {
      // Silently fail and continue
    }
  }

  next();
};

interface SIWSMessageData {
  domain: string;
  address: string;
  statement: string;
  timestamp: string;
  nonce?: string;
}

function parseSIWSMessage(message: string): SIWSMessageData | null {
  try {
    // Expected format:
    // domain wants you to sign in with your Solana account:
    // address
    //
    // statement
    //
    // Timestamp: ISO8601
    // Nonce: random

    const lines = message.split('\n');
    if (lines.length < 3) return null;

    const domainMatch = lines[0]?.match(/^(.+?) wants you to sign in/);
    if (!domainMatch) return null;
    const domain = domainMatch[1] || '';

    const address = lines[1] || '';
    if (!address) return null;

    let statement = '';
    let timestamp = '';
    let nonce = '';

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.startsWith('Timestamp:')) {
        timestamp = line.replace('Timestamp:', '').trim();
      } else if (line.startsWith('Nonce:')) {
        nonce = line.replace('Nonce:', '').trim();
      } else if (line && !line.startsWith('Timestamp') && !line.startsWith('Nonce')) {
        statement += line + '\n';
      }
    }

    if (!timestamp) return null;

    return {
      domain,
      address,
      statement: statement.trim(),
      timestamp,
      nonce,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a SIWS message for client to sign
 */
export function generateSIWSMessage(params: {
  domain: string;
  address: string;
  statement: string;
  nonce?: string;
}): string {
  const timestamp = new Date().toISOString();
  const nonce = params.nonce || Math.random().toString(36).substring(7);

  return `${params.domain} wants you to sign in with your Solana account:
${params.address}

${params.statement}

Timestamp: ${timestamp}
Nonce: ${nonce}`;
}

