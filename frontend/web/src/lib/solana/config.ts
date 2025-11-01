import { PublicKey, clusterApiUrl } from '@solana/web3.js';

export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet';
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_NETWORK);
export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'DSzcxNHsezokjETdk9ymJYvR27bGS876g2EqoVxQraQE');
export const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'); // Devnet USDC

export const WALLET_CONFIG = {
  autoConnect: false,
  network: SOLANA_NETWORK,
  rpcUrl: SOLANA_RPC_URL,
};

