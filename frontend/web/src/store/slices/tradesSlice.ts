import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { tradesApi } from '../../lib/api/trades';
import {
  CreateTradeRequest,
  CreateTradeResponse,
  TradeIntentStatus,
  Trade,
} from '../../types/trade';
import { ApiError } from '../../types/api';
import { SSEClient } from '../../lib/sse/client';

interface TradesState {
  activeIntents: Record<string, TradeIntentStatus>;
  recentTrades: Trade[];
  sseConnections: Record<string, SSEClient>;
  loading: boolean;
  error: string | null;
}

const initialState: TradesState = {
  activeIntents: {},
  recentTrades: [],
  sseConnections: {},
  loading: false,
  error: null,
};

// Async thunks
export const createTrade = createAsyncThunk<
  CreateTradeResponse,
  { data: CreateTradeRequest; idempotencyKey?: string },
  { rejectValue: ApiError }
>('trades/createTrade', async ({ data, idempotencyKey }, { rejectWithValue }) => {
  try {
    const response = await tradesApi.createTrade(data, idempotencyKey);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const getTradeStatus = createAsyncThunk<
  TradeIntentStatus,
  string,
  { rejectValue: ApiError }
>('trades/getTradeStatus', async (intentId, { rejectWithValue }) => {
  try {
    const response = await tradesApi.getTradeStatus(intentId);
    if (response.data) {
      return response.data;
    }
    throw new Error('No data received');
  } catch (error) {
    return rejectWithValue(error as ApiError);
  }
});

export const getRecentTrades = createAsyncThunk<Trade[], number | undefined, { rejectValue: ApiError }>(
  'trades/getRecentTrades',
  async (limit, { rejectWithValue }) => {
    try {
      const response = await tradesApi.getRecentTrades(limit);
      return response.data || [];
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

const tradesSlice = createSlice({
  name: 'trades',
  initialState,
  reducers: {
    updateTradeStatus: (state, action: PayloadAction<TradeIntentStatus>) => {
      state.activeIntents[action.payload.intentId] = action.payload;
    },
    connectSSE: (
      state,
      action: PayloadAction<{ intentId: string; client: SSEClient }>
    ) => {
      state.sseConnections[action.payload.intentId] = action.payload.client;
    },
    disconnectSSE: (state, action: PayloadAction<string>) => {
      const client = state.sseConnections[action.payload];
      if (client) {
        client.close();
        delete state.sseConnections[action.payload];
      }
    },
    disconnectAllSSE: (state) => {
      Object.values(state.sseConnections).forEach((client) => client.close());
      state.sseConnections = {};
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Create Trade
    builder
      .addCase(createTrade.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTrade.fulfilled, (state, action: PayloadAction<CreateTradeResponse>) => {
        state.loading = false;
        // Initialize the intent status
        state.activeIntents[action.payload.intentId] = {
          intentId: action.payload.intentId,
          status: 'PENDING' as any,
        };
      })
      .addCase(createTrade.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create trade';
      });

    // Get Trade Status
    builder
      .addCase(getTradeStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(getTradeStatus.fulfilled, (state, action: PayloadAction<TradeIntentStatus>) => {
        state.loading = false;
        state.activeIntents[action.payload.intentId] = action.payload;
      })
      .addCase(getTradeStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch trade status';
      });

    // Get Recent Trades
    builder
      .addCase(getRecentTrades.pending, (state) => {
        state.loading = true;
      })
      .addCase(getRecentTrades.fulfilled, (state, action: PayloadAction<Trade[]>) => {
        state.loading = false;
        state.recentTrades = action.payload;
      })
      .addCase(getRecentTrades.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch recent trades';
      });
  },
});

export const {
  updateTradeStatus,
  connectSSE,
  disconnectSSE,
  disconnectAllSSE,
  clearError,
} = tradesSlice.actions;

export default tradesSlice.reducer;

