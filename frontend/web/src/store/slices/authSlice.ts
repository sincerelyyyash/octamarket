import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../lib/api/auth';
import { setAuthToken, clearAuthToken, getAuthToken } from '../../lib/api/client';
import {
  User,
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  ConnectWalletRequest,
} from '../../types/user';
import { ApiError } from '../../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

// Async thunks
export const register = createAsyncThunk<
  { user: User; token: string },
  RegisterRequest,
  { rejectValue: ApiError }
>('auth/register', async (data, { rejectWithValue }) => {
  try {
    const response = await authApi.register(data);
    if (response.data) {
      setAuthToken(response.data.token);
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const login = createAsyncThunk<
  { user: User; token: string },
  LoginRequest,
  { rejectValue: ApiError }
>('auth/login', async (data, { rejectWithValue }) => {
  try {
    const response = await authApi.login(data);
    if (response.data) {
      setAuthToken(response.data.token);
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const getProfile = createAsyncThunk<User, void, { rejectValue: ApiError }>(
  'auth/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfile();
      if (response.data) {
        return response.data;
      }
      throw new Error('No data received');
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const updateProfile = createAsyncThunk<
  User,
  UpdateProfileRequest,
  { rejectValue: ApiError }
>('auth/updateProfile', async (data, { rejectWithValue }) => {
  try {
    const response = await authApi.updateProfile(data);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const connectWallet = createAsyncThunk<
  { walletAddress: string },
  ConnectWalletRequest,
  { rejectValue: ApiError }
>('auth/connectWallet', async (data, { rejectWithValue }) => {
  try {
    const response = await authApi.connectWallet(data);
    if (response.data) {
      return { walletAddress: response.data.walletAddress };
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const initializeAuth = createAsyncThunk<
  { user: User; token: string } | null,
  void,
  { rejectValue: ApiError }
>('auth/initialize', async (_, { rejectWithValue }) => {
  try {
    const token = getAuthToken();
    if (!token) {
      return null;
    }

    const response = await authApi.getProfile();
    if (response.data) {
      return { user: response.data, token };
    }
    return null;
  } catch (error) {
    clearAuthToken();
    return rejectWithValue(error as ApiError);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      clearAuthToken();
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<{ user: User; token: string }>) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Registration failed';
      });

    // Login
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{ user: User; token: string }>) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Login failed';
      });

    // Get Profile
    builder
      .addCase(getProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(getProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch profile';
      });

    // Update Profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update profile';
      });

    // Connect Wallet
    builder
      .addCase(connectWallet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user.walletAddress = action.payload.walletAddress;
        }
        state.error = null;
      })
      .addCase(connectWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to connect wallet';
      });

    // Initialize Auth
    builder
      .addCase(initializeAuth.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;

