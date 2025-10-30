import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { marketsApi } from '../../lib/api/markets';
import { Market, MarketOutcome, PriceHistoryPoint, MarketFilters } from '../../types/market';
import { ApiError, PaginationMeta, SortParams } from '../../types/api';

interface MarketsState {
  markets: Market[];
  selectedMarket: Market | null;
  categories: string[];
  tags: string[];
  priceHistory: PriceHistoryPoint[];
  filters: MarketFilters;
  sortParams: SortParams;
  pagination: PaginationMeta | null;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

const initialState: MarketsState = {
  markets: [],
  selectedMarket: null,
  categories: [],
  tags: [],
  priceHistory: [],
  filters: {},
  sortParams: { sortBy: 'volume', sortOrder: 'desc' },
  pagination: null,
  loading: false,
  error: null,
  lastFetch: null,
};

// Async thunks
export const fetchMarkets = createAsyncThunk<
  { markets: Market[]; meta?: PaginationMeta },
  { page?: number; limit?: number; filters?: MarketFilters; sortParams?: SortParams },
  { rejectValue: ApiError }
>('markets/fetchMarkets', async ({ page = 1, limit = 20, filters, sortParams }, { rejectWithValue }) => {
  try {
    const response = await marketsApi.getMarkets({
      page,
      limit,
      ...filters,
      ...sortParams,
    });
    return {
      markets: response.data || [],
      meta: response.meta,
    };
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchMarketById = createAsyncThunk<Market, string, { rejectValue: ApiError }>(
  'markets/fetchMarketById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await marketsApi.getMarketById(id);
      if (response.data) {
        return response.data;
      }
      throw new Error('No data received');
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchMarketOutcomes = createAsyncThunk<
  MarketOutcome[],
  string,
  { rejectValue: ApiError }
>('markets/fetchMarketOutcomes', async (id, { rejectWithValue }) => {
  try {
    const response = await marketsApi.getMarketOutcomes(id);
    return response.data || [];
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchPriceHistory = createAsyncThunk<
  PriceHistoryPoint[],
  { id: string; params?: any },
  { rejectValue: ApiError }
>('markets/fetchPriceHistory', async ({ id, params }, { rejectWithValue }) => {
  try {
    const response = await marketsApi.getPriceHistory(id, params);
    return response.data || [];
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchActiveMarkets = createAsyncThunk<
  { markets: Market[]; meta?: PaginationMeta },
  { page?: number; limit?: number },
  { rejectValue: ApiError }
>('markets/fetchActiveMarkets', async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
  try {
    const response = await marketsApi.getActiveMarkets({ page, limit });
    return {
      markets: response.data || [],
      meta: response.meta,
    };
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchTrendingMarkets = createAsyncThunk<
  { markets: Market[]; meta?: PaginationMeta },
  { page?: number; limit?: number },
  { rejectValue: ApiError }
>('markets/fetchTrendingMarkets', async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
  try {
    const response = await marketsApi.getTrendingMarkets({ page, limit });
    return {
      markets: response.data || [],
      meta: response.meta,
    };
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const fetchCategories = createAsyncThunk<string[], void, { rejectValue: ApiError }>(
  'markets/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await marketsApi.getCategories();
      return response.data || [];
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchTags = createAsyncThunk<string[], void, { rejectValue: ApiError }>(
  'markets/fetchTags',
  async (_, { rejectWithValue }) => {
    try {
      const response = await marketsApi.getTags();
      return response.data || [];
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

const marketsSlice = createSlice({
  name: 'markets',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<MarketFilters>) => {
      state.filters = action.payload;
    },
    setSortParams: (state, action: PayloadAction<SortParams>) => {
      state.sortParams = action.payload;
    },
    clearSelectedMarket: (state) => {
      state.selectedMarket = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Markets
    builder
      .addCase(fetchMarkets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMarkets.fulfilled, (state, action) => {
        state.loading = false;
        state.markets = action.payload.markets;
        state.pagination = action.payload.meta || null;
        state.lastFetch = Date.now();
      })
      .addCase(fetchMarkets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch markets';
      });

    // Fetch Market By ID
    builder
      .addCase(fetchMarketById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMarketById.fulfilled, (state, action: PayloadAction<Market>) => {
        state.loading = false;
        state.selectedMarket = action.payload;
      })
      .addCase(fetchMarketById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch market';
      });

    // Fetch Price History
    builder
      .addCase(fetchPriceHistory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPriceHistory.fulfilled, (state, action: PayloadAction<PriceHistoryPoint[]>) => {
        state.loading = false;
        state.priceHistory = action.payload;
      })
      .addCase(fetchPriceHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch price history';
      });

    // Fetch Active Markets
    builder
      .addCase(fetchActiveMarkets.fulfilled, (state, action) => {
        state.markets = action.payload.markets;
        state.pagination = action.payload.meta || null;
      });

    // Fetch Trending Markets
    builder
      .addCase(fetchTrendingMarkets.fulfilled, (state, action) => {
        state.markets = action.payload.markets;
        state.pagination = action.payload.meta || null;
      });

    // Fetch Categories
    builder
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.categories = action.payload;
      });

    // Fetch Tags
    builder
      .addCase(fetchTags.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.tags = action.payload;
      });
  },
});

export const { setFilters, setSortParams, clearSelectedMarket, clearError } = marketsSlice.actions;
export default marketsSlice.reducer;

