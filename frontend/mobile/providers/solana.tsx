import React, { type PropsWithChildren, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react-native';
import { clusterApiUrl } from '@solana/web3.js';
import {
  BackpackWalletAdapter,
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-wallets';

type SolanaProviderProps = PropsWithChildren<{
  endpoint?: string;
}>;

export const SolanaProvider: React.FC<SolanaProviderProps> = ({ children, endpoint }) => {
  const rpcEndpoint = endpoint ?? clusterApiUrl('devnet');

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={rpcEndpoint} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};


