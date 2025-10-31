'use client';

import { Provider } from 'react-redux';
import { store } from '../store';
import { useEffect } from 'react';
import { initializeAuth } from '../store/slices/authSlice';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    store.dispatch(initializeAuth());
  }, []);

  return <Provider store={store}>{children}</Provider>;
}

