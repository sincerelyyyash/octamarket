import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import marketsReducer from "./slices/marketsSlice";
import tradersReducer from "./slices/tradersSlice";
import tradesReducer from "./slices/tradesSlice";
import copyTradingReducer from "./slices/copyTradingSlice";
import statsReducer from "./slices/statsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    markets: marketsReducer,
    traders: tradersReducer,
    trades: tradesReducer,
    copyTrading: copyTradingReducer,
    stats: statsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for non-serializable values
        ignoredActions: ["trades/connectSSE"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
