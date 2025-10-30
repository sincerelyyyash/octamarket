import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { tradersApi } from '../../lib/api/traders';
import { leaderboardApi } from '../../lib/api/leaderboard';
import { Trader, TraderStats, TraderFollower, LeaderboardSnapshot } from '../../types/trader';
import { Trade } from '../../types/trade';
import { ApiError, PaginationMeta, SortParams, TimeframeFilter } from '../../types/api';
import { MarketSource } from '../../types/market';

interface TradersState {
  traders: Trader[];
  selectedTrader: Trader | null;
  traderStats: TraderStats | null;
  traderTrades: Trade[];
  traderFollowers: TraderFollower[];
  leaderboard: Trader[];
  leaderboardSnapshots: LeaderboardSnapshot[];
  filters: {
    source?: MarketSource;
    allowCopyTrading?: boolean;
    isPublic?: boolean;
    search?: string;
    timeframe?: TimeframeFilter;
  };
  sortParams: SortParams;
  pagination: PaginationMeta | null;
  loading: boolean;
  error: string | null;
}

const initialState: TradersState = {
  traders: [],
  selectedTrader: null,
  traderStats: null,
  traderTrades: [],
  traderFollowers: [],
  leaderboard: [],
  leaderboardSnapshots: [],
  filters: {},
  sortParams: { sortBy: 'totalPnl', sortOrder: 'desc' },
  pagination: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchTraders = createAsyncThunk<
  { traders: Trader[]; meta?: PaginationMeta },
  {
    page?: number;
    limit?: number;
    source?: MarketSource;
    allowCopyTrading?: boolean;
    isPublic?: boolean;
    search?: string;
    sortParams?: SortParams;
  },
  { rejectValue: ApiError }
>(
  'traders/fetchTraders',
  async ({ page = 1, limit = 20, source, allowCopyTrading, isPublic, search, sortParams }, { rejectWithValue }) => {
    try {
      const response = await tradersApi.getTraders({
        page,
        limit,
        source,
        allowCopyTrading,
        isPublic,
        search,
        ...sortParams,
      });
      return {
        traders: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchTraderById = createAsyncThunk<Trader, string, { rejectValue: ApiError }>(
  'traders/fetchTraderById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await tradersApi.getTraderById(id);
      if (response.data) {
        return response.data;
      }
      throw new Error('No data received');
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchTraderStats = createAsyncThunk<TraderStats, string, { rejectValue: ApiError }>(
  'traders/fetchTraderStats',
  async (id, { rejectWithValue }) => {
    try {
      const response = await tradersApi.getTraderStats(id);
      if (response.data) {
        return response.data;
      }
      throw new Error('No data received');
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchTraderTrades = createAsyncThunk<
  { trades: Trade[]; meta?: PaginationMeta },
  { id: string; page?: number; limit?: number; params?: any },
  { rejectValue: ApiError }
>('traders/fetchTraderTrades', async ({ id, page = 1, limit = 20, params }, { rejectWithValue }) => {
  try {
    const response = await tradersApi.getTraderTrades(id, { page, limit, ...params });
    return {
      trades: response.data || [],
      meta: response.meta,
    };
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchTraderFollowers = createAsyncThunk<
  { followers: TraderFollower[]; meta?: PaginationMeta },
  { id: string; page?: number; limit?: number },
  { rejectValue: ApiError }
>('traders/fetchTraderFollowers', async ({ id, page = 1, limit = 20 }, { rejectWithValue }) => {
  try {
    const response = await tradersApi.getTraderFollowers(id, { page, limit });
    return {
      followers: response.data || [],
      meta: response.meta,
    };
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchLeaderboard = createAsyncThunk<
  { traders: Trader[]; meta?: PaginationMeta },
  {
    page?: number;
    limit?: number;
    source?: MarketSource;
    timeframe?: TimeframeFilter;
    sortParams?: SortParams;
  },
  { rejectValue: ApiError }
>(
  'traders/fetchLeaderboard',
  async ({ page = 1, limit = 20, source, timeframe, sortParams }, { rejectWithValue }) => {
    try {
      const response = await leaderboardApi.getLeaderboard({
        page,
        limit,
        source,
        timeframe,
        ...sortParams,
      });
      return {
        traders: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchLeaderboardBySource = createAsyncThunk<
  { traders: Trader[]; meta?: PaginationMeta },
  { source: MarketSource; page?: number; limit?: number; timeframe?: TimeframeFilter },
  { rejectValue: ApiError }
>(
  'traders/fetchLeaderboardBySource',
  async ({ source, page = 1, limit = 20, timeframe }, { rejectWithValue }) => {
    try {
      const response = await leaderboardApi.getLeaderboardBySource(source, {
        page,
        limit,
        timeframe,
      });
      return {
        traders: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchTopTraders = createAsyncThunk<
  { traders: Trader[]; meta?: PaginationMeta },
  { page?: number; limit?: number; source?: MarketSource; timeframe?: TimeframeFilter },
  { rejectValue: ApiError }
>(
  'traders/fetchTopTraders',
  async ({ page = 1, limit = 20, source, timeframe }, { rejectWithValue }) => {
    try {
      const response = await leaderboardApi.getTopTraders({
        page,
        limit,
        source,
        timeframe,
      });
      return {
        traders: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchRisingTraders = createAsyncThunk<
  { traders: Trader[]; meta?: PaginationMeta },
  { page?: number; limit?: number; source?: MarketSource; timeframe?: TimeframeFilter },
  { rejectValue: ApiError }
>(
  'traders/fetchRisingTraders',
  async ({ page = 1, limit = 20, source, timeframe }, { rejectWithValue }) => {
    try {
      const response = await leaderboardApi.getRisingTraders({
        page,
        limit,
        source,
        timeframe,
      });
      return {
        traders: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchLeaderboardSnapshots = createAsyncThunk<
  LeaderboardSnapshot[],
  { source?: MarketSource; limit?: number },
  { rejectValue: ApiError }
>('traders/fetchLeaderboardSnapshots', async ({ source, limit }, { rejectWithValue }) => {
  try {
    const response = await leaderboardApi.getLeaderboardSnapshots({ source, limit });
    return response.data || [];
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

const tradersSlice = createSlice({
  name: 'traders',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<TradersState['filters']>) => {
      state.filters = action.payload;
    },
    setSortParams: (state, action: PayloadAction<SortParams>) => {
      state.sortParams = action.payload;
    },
    clearSelectedTrader: (state) => {
      state.selectedTrader = null;
      state.traderStats = null;
      state.traderTrades = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Traders
    builder
      .addCase(fetchTraders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTraders.fulfilled, (state, action) => {
        state.loading = false;
        state.traders = action.payload.traders;
        state.pagination = action.payload.meta || null;
      })
      .addCase(fetchTraders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch traders';
      });

    // Fetch Trader By ID
    builder
      .addCase(fetchTraderById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTraderById.fulfilled, (state, action: PayloadAction<Trader>) => {
        state.loading = false;
        state.selectedTrader = action.payload;
      })
      .addCase(fetchTraderById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch trader';
      });

    // Fetch Trader Stats
    builder
      .addCase(fetchTraderStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTraderStats.fulfilled, (state, action: PayloadAction<TraderStats>) => {
        state.loading = false;
        state.traderStats = action.payload;
      })
      .addCase(fetchTraderStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch trader stats';
      });

    // Fetch Trader Trades
    builder
      .addCase(fetchTraderTrades.fulfilled, (state, action) => {
        state.traderTrades = action.payload.trades;
      });

    // Fetch Trader Followers
    builder
      .addCase(fetchTraderFollowers.fulfilled, (state, action) => {
        state.traderFollowers = action.payload.followers;
      });

    // Fetch Leaderboard
    builder
      .addCase(fetchLeaderboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.loading = false;
        state.leaderboard = action.payload.traders;
        state.pagination = action.payload.meta || null;
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch leaderboard';
      });

    // Fetch Leaderboard By Source
    builder
      .addCase(fetchLeaderboardBySource.fulfilled, (state, action) => {
        state.leaderboard = action.payload.traders;
        state.pagination = action.payload.meta || null;
      });

    // Fetch Top Traders
    builder
      .addCase(fetchTopTraders.fulfilled, (state, action) => {
        state.traders = action.payload.traders;
        state.pagination = action.payload.meta || null;
      });

    // Fetch Rising Traders
    builder
      .addCase(fetchRisingTraders.fulfilled, (state, action) => {
        state.traders = action.payload.traders;
        state.pagination = action.payload.meta || null;
      });

    // Fetch Leaderboard Snapshots
    builder
      .addCase(fetchLeaderboardSnapshots.fulfilled, (state, action: PayloadAction<LeaderboardSnapshot[]>) => {
        state.leaderboardSnapshots = action.payload;
      });
  },
});

export const { setFilters, setSortParams, clearSelectedTrader, clearError } = tradersSlice.actions;
export default tradersSlice.reducer;

