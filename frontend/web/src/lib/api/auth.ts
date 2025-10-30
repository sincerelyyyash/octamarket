import { post, get, patch } from './client';
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  ConnectWalletRequest,
  ConnectWalletResponse,
  User,
} from '../../types/user';
import { ApiResponse } from '../../types/api';

export const authApi = {
  // Register new user
  register: (data: RegisterRequest): Promise<ApiResponse<AuthResponse>> => {
    return post<AuthResponse>('/api/auth/register', data);
  },

  // Login
  login: (data: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
    return post<AuthResponse>('/api/auth/login', data);
  },

  // Get current user profile
  getProfile: (): Promise<ApiResponse<User>> => {
    return get<User>('/api/auth/me');
  },

  // Update user profile
  updateProfile: (data: UpdateProfileRequest): Promise<ApiResponse<User>> => {
    return patch<User>('/api/auth/profile', data);
  },

  // Connect wallet
  connectWallet: (data: ConnectWalletRequest): Promise<ApiResponse<ConnectWalletResponse>> => {
    return post<ConnectWalletResponse>('/api/auth/wallet/connect', data);
  },
};

