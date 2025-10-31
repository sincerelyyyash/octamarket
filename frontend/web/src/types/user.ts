export interface User {
  id: string;
  name: string;
  email: string;
  walletAddress?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface ConnectWalletRequest {
  walletAddress: string;
}

export interface ConnectWalletResponse {
  walletAddress: string;
  connectedAt: string;
}

