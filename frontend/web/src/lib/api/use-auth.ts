import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from './client';
import type { RegisterRequest, LoginRequest, AuthResponse } from './types';

// Register mutation
export function useRegister(): UseMutationResult<AuthResponse, Error, RegisterRequest> {
  return useMutation({
    mutationFn: (request: RegisterRequest) => 
      apiClient.post<AuthResponse>('/auth/register', request),
    onSuccess: (data) => {
      // Set auth token on successful registration
      apiClient.setAuthToken(data.token);
    },
  });
}

// Login mutation
export function useLogin(): UseMutationResult<AuthResponse, Error, LoginRequest> {
  return useMutation({
    mutationFn: (request: LoginRequest) => 
      apiClient.post<AuthResponse>('/auth/login', request),
    onSuccess: (data) => {
      // Set auth token on successful login
      apiClient.setAuthToken(data.token);
    },
  });
}

// Logout helper
export function useLogout() {
  return () => {
    apiClient.clearAuthToken();
    // Optionally redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };
}


