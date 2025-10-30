import { PublicKey } from '@solana/web3.js';

export type SolanaConfig = {
  rpcUrl: string;
  programId: PublicKey;
  usdcMint: PublicKey;
  relayerPrivateKey: string; // Base58 encoded
};

export const getSolanaConfig = (): SolanaConfig => {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  
  if (network === 'mainnet') {
    return {
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      programId: new PublicKey(process.env.SOLANA_PROGRAM_ID || 'DSzcxNHsezokjETdk9ymJYvR27bGS876g2EqoVxQraQE'),
      usdcMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // Mainnet USDC
      relayerPrivateKey: process.env.SOLANA_RELAYER_PRIVATE_KEY || '',
    };
  }
  
  // Devnet
  return {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    programId: new PublicKey(process.env.SOLANA_PROGRAM_ID || 'DSzcxNHsezokjETdk9ymJYvR27bGS876g2EqoVxQraQE'),
    usdcMint: new PublicKey(process.env.DEVNET_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), // Devnet USDC
    relayerPrivateKey: process.env.SOLANA_RELAYER_PRIVATE_KEY || '',
  };
};

