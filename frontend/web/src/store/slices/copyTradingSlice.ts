import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { copyTradingApi } from '../../lib/api/copyTrading';
import {
  CopyTradingFollow,
  FollowTraderRequest,
  UpdateCopySettingsRequest,
  CopyTradingStats,
} from '../../types/copyTrading';
import { ApiError, PaginationMeta } from '../../types/api';

interface CopyTradingState {
  follows: CopyTradingFollow[];
  stats: CopyTradingStats | null;
  pagination: PaginationMeta | null;
  loading: boolean;
  error: string | null;
}

const initialState: CopyTradingState = {
  follows: [],
  stats: null,
  pagination: null,
  loading: false,
  error: null,
};

// Async thunks
export const followTrader = createAsyncThunk<
  CopyTradingFollow,
  FollowTraderRequest,
  { rejectValue: ApiError }
>('copyTrading/followTrader', async (data, { rejectWithValue }) => {
  try {
    const response = await copyTradingApi.followTrader(data);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const unfollowTrader = createAsyncThunk<string, string, { rejectValue: ApiError }>(
  'copyTrading/unfollowTrader',
  async (traderId, { rejectWithValue }) => {
    try {
      await copyTradingApi.unfollowTrader(traderId);
      return traderId;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const updateCopySettings = createAsyncThunk<
  CopyTradingFollow,
  { followId: string; data: UpdateCopySettingsRequest },
  { rejectValue: ApiError }
>('copyTrading/updateCopySettings', async ({ followId, data }, { rejectWithValue }) => {
  try {
    const response = await copyTradingApi.updateCopySettings(followId, data);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const getMyFollows = createAsyncThunk<
  { follows: CopyTradingFollow[]; meta?: PaginationMeta },
  { page?: number; limit?: number },
  { rejectValue: ApiError }
>('copyTrading/getMyFollows', async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
  try {
    const response = await copyTradingApi.getMyFollows({ page, limit });
    return {
      follows: response.data || [],
      meta: response.meta,
    };
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const getCopyTradingStats = createAsyncThunk<
  CopyTradingStats,
  void,
  { rejectValue: ApiError }
>('copyTrading/getCopyTradingStats', async (_, { rejectWithValue }) => {
  try {
    const response = await copyTradingApi.getCopyTradingStats();
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

const copyTradingSlice = createSlice({
  name: 'copyTrading',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Follow Trader
    builder
      .addCase(followTrader.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(followTrader.fulfilled, (state, action: PayloadAction<CopyTradingFollow>) => {
        state.loading = false;
        state.follows.push(action.payload);
      })
      .addCase(followTrader.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to follow trader';
      });

    // Unfollow Trader
    builder
      .addCase(unfollowTrader.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(unfollowTrader.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.follows = state.follows.filter(
          (follow) => follow.followingId !== action.payload
        );
      })
      .addCase(unfollowTrader.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to unfollow trader';
      });

    // Update Copy Settings
    builder
      .addCase(updateCopySettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCopySettings.fulfilled, (state, action: PayloadAction<CopyTradingFollow>) => {
        state.loading = false;
        const index = state.follows.findIndex((follow) => follow.id === action.payload.id);
        if (index !== -1) {
          state.follows[index] = action.payload;
        }
      })
      .addCase(updateCopySettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update copy settings';
      });

    // Get My Follows
    builder
      .addCase(getMyFollows.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMyFollows.fulfilled, (state, action) => {
        state.loading = false;
        state.follows = action.payload.follows;
        state.pagination = action.payload.meta || null;
      })
      .addCase(getMyFollows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch follows';
      });

    // Get Copy Trading Stats
    builder
      .addCase(getCopyTradingStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCopyTradingStats.fulfilled, (state, action: PayloadAction<CopyTradingStats>) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(getCopyTradingStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch copy trading stats';
      });
  },
});

export const { clearError } = copyTradingSlice.actions;
export default copyTradingSlice.reducer;

