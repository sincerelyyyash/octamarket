export interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
}

export interface WalletInfo {
  publicKey: string;
  balance?: number;
  connected: boolean;
}

