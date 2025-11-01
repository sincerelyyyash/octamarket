'use client';

import { Provider } from 'react-redux';
import { store } from '../store';
import WalletProvider from './wallet/WalletProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <WalletProvider>
        {children}
      </WalletProvider>
    </Provider>
  );
}

