'use client';

import { useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useAppDispatch } from '../store/hooks';
import {
  setWalletConnected,
  setWalletConnecting,
  setWalletDisconnected,
  setWalletDisconnecting,
  setWalletError,
} from '../store/slices/authSlice';

export function useWalletSync() {
  const { publicKey, connected, connecting, disconnecting } = useSolanaWallet();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (connecting) {
      dispatch(setWalletConnecting());
    } else if (disconnecting) {
      dispatch(setWalletDisconnecting());
    } else if (connected && publicKey) {
      dispatch(setWalletConnected({ publicKey: publicKey.toBase58() }));
    } else if (!connected) {
      dispatch(setWalletDisconnected());
    }
  }, [publicKey, connected, connecting, disconnecting, dispatch]);

  return { publicKey, connected, connecting, disconnecting };
}

