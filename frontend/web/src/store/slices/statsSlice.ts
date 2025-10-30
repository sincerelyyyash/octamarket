import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { statsApi } from '../../lib/api/stats';
import { PlatformStats, MarketStats, SourceStatsResponse } from '../../types/stats';
import { ApiError, TimeframeFilter } from '../../types/api';

interface StatsState {
  platformStats: PlatformStats | null;
  marketStats: MarketStats | null;
  sourceStats: SourceStatsResponse | null;
  timeframe: TimeframeFilter;
  loading: boolean;
  error: string | null;
}

const initialState: StatsState = {
  platformStats: null,
  marketStats: null,
  sourceStats: null,
  timeframe: 'all',
  loading: false,
  error: null,
};

// Async thunks
export const fetchPlatformStats = createAsyncThunk<
  PlatformStats,
  TimeframeFilter | undefined,
  { rejectValue: ApiError }
>('stats/fetchPlatformStats', async (timeframe, { rejectWithValue }) => {
  try {
    const response = await statsApi.getPlatformStats(timeframe);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchMarketStats = createAsyncThunk<
  MarketStats,
  { page?: number; limit?: number } | undefined,
  { rejectValue: ApiError }
>('stats/fetchMarketStats', async (params, { rejectWithValue }) => {
  try {
    const response = await statsApi.getMarketStats(params);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchSourceStats = createAsyncThunk<
  SourceStatsResponse,
  TimeframeFilter | undefined,
  { rejectValue: ApiError }
>('stats/fetchSourceStats', async (timeframe, { rejectWithValue }) => {
  try {
    const response = await statsApi.getSourceStats(timeframe);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {
    setTimeframe: (state, action: PayloadAction<TimeframeFilter>) => {
      state.timeframe = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Platform Stats
    builder
      .addCase(fetchPlatformStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlatformStats.fulfilled, (state, action: PayloadAction<PlatformStats>) => {
        state.loading = false;
        state.platformStats = action.payload;
      })
      .addCase(fetchPlatformStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch platform stats';
      });

    // Fetch Market Stats
    builder
      .addCase(fetchMarketStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMarketStats.fulfilled, (state, action: PayloadAction<MarketStats>) => {
        state.loading = false;
        state.marketStats = action.payload;
      })
      .addCase(fetchMarketStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch market stats';
      });

    // Fetch Source Stats
    builder
      .addCase(fetchSourceStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSourceStats.fulfilled, (state, action: PayloadAction<SourceStatsResponse>) => {
        state.loading = false;
        state.sourceStats = action.payload;
      })
      .addCase(fetchSourceStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch source stats';
      });
  },
});

export const { setTimeframe, clearError } = statsSlice.actions;
export default statsSlice.reducer;

