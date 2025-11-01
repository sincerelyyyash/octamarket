import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WalletState } from '../../types/wallet';

interface AuthState {
  wallet: WalletState;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  wallet: {
    publicKey: null,
    connected: false,
    connecting: false,
    disconnecting: false,
  },
  isAuthenticated: false,
  loading: false,
  error: null,
};

// No async thunks needed - wallet connection is handled by Solana wallet adapter

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setWalletConnected: (state, action: PayloadAction<{ publicKey: string }>) => {
      state.wallet.publicKey = action.payload.publicKey;
      state.wallet.connected = true;
      state.wallet.connecting = false;
      state.isAuthenticated = true;
      state.error = null;
    },
    setWalletConnecting: (state) => {
      state.wallet.connecting = true;
      state.error = null;
    },
    setWalletDisconnected: (state) => {
      state.wallet.publicKey = null;
      state.wallet.connected = false;
      state.wallet.connecting = false;
      state.wallet.disconnecting = false;
      state.isAuthenticated = false;
      state.error = null;
    },
    setWalletDisconnecting: (state) => {
      state.wallet.disconnecting = true;
    },
    setWalletError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.wallet.connecting = false;
      state.wallet.disconnecting = false;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setWalletConnected,
  setWalletConnecting,
  setWalletDisconnected,
  setWalletDisconnecting,
  setWalletError,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;

