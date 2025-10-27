# Frontend Setup Guide - React Query Integration

## Required Dependencies

Add these dependencies to your `package.json`:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools axios
# or
bun add @tanstack/react-query @tanstack/react-query-devtools axios
```

## Environment Variables

Create a `.env.local` file in `frontend/web/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Project Structure

```
frontend/web/src/
├── lib/api/                 # API client library (✅ Complete)
│   ├── client.ts           # Axios client with auth
│   ├── types.ts            # TypeScript types
│   ├── query-keys.ts       # React Query keys
│   ├── use-markets.ts      # Market hooks
│   ├── use-arbitrage.ts    # Arbitrage hooks
│   ├── use-leaders.ts      # Leader hooks
│   ├── use-orders.ts       # Order hooks
│   ├── use-wallets.ts      # Wallet hooks
│   ├── use-auth.ts         # Auth hooks
│   └── index.ts            # Main exports
├── providers/               # React providers (✅ Complete)
│   └── query-provider.tsx  # React Query provider
├── hooks/                   # Custom hooks (✅ Updated)
│   └── useTraderData.ts    # Now uses real API
└── app/
    └── layout.tsx          # Updated with QueryProvider
```

## Usage Examples

### 1. Markets

```tsx
import { useMarkets, useBestPrice } from '@/lib/api';

function MarketsList() {
  const { data: markets, isLoading } = useMarkets({ limit: 50 });
  
  if (isLoading) return <div>Loading markets...</div>;
  
  return (
    <div>
      {markets?.map(market => (
        <MarketCard key={market.event_fingerprint} market={market} />
      ))}
    </div>
  );
}

function MarketDetails({ eventFingerprint }: { eventFingerprint: string }) {
  const { data: bestPrice } = useBestPrice(eventFingerprint);
  
  return (
    <div>
      <p>Best Yes Price: {bestPrice?.best_yes_price} on {bestPrice?.best_yes_platform}</p>
      <p>Best No Price: {bestPrice?.best_no_price} on {bestPrice?.best_no_platform}</p>
    </div>
  );
}
```

### 2. Arbitrage

```tsx
import { useArbitrageOpportunities } from '@/lib/api';

function ArbitrageList() {
  const { data: opportunities, isLoading } = useArbitrageOpportunities({ limit: 20 });
  
  if (isLoading) return <div>Loading opportunities...</div>;
  
  return (
    <div>
      {opportunities?.map(opp => (
        <div key={opp.id}>
          <h3>{opp.event_title}</h3>
          <p>Profit: {opp.profit_pct.toFixed(2)}%</p>
          <p>Buy on {opp.buy_platform} @ {opp.buy_price}</p>
          <p>Sell on {opp.sell_platform} @ {opp.sell_price}</p>
        </div>
      ))}
    </div>
  );
}
```

### 3. Leaders

```tsx
import { useLeaders, useWalletLeaderboard } from '@/lib/api';

function LeadersList() {
  const { data: leaders, isLoading } = useLeaders();
  
  if (isLoading) return <div>Loading leaders...</div>;
  
  return (
    <div>
      {leaders?.map(leader => (
        <div key={leader.leader_id}>
          <h3>{leader.name}</h3>
          <p>30D PnL: {leader.pnl_30d.toFixed(2)}</p>
          <p>Win Rate: {(leader.win_rate * 100).toFixed(2)}%</p>
          <p>Followers: {leader.followers_count}</p>
        </div>
      ))}
    </div>
  );
}
```

### 4. Orders (with Mutations)

```tsx
import { usePlaceOrder, useMyOrders, useCancelOrder } from '@/lib/api';

function OrderForm() {
  const placeOrder = usePlaceOrder();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    placeOrder.mutate({
      market_id: 'some-market-id',
      platform: 'polymarket',
      side: 'buy',
      outcome: 'Yes',
      price: 0.55,
      amount: 100,
      order_type: 'limit'
    }, {
      onSuccess: (data) => {
        console.log('Order placed:', data.order_id);
      },
      onError: (error) => {
        console.error('Order failed:', error);
      }
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={placeOrder.isPending}>
        {placeOrder.isPending ? 'Placing...' : 'Place Order'}
      </button>
    </form>
  );
}

function MyOrders() {
  const { data: orders } = useMyOrders();
  const cancelOrder = useCancelOrder();
  
  const handleCancel = (orderId: string) => {
    cancelOrder.mutate(orderId, {
      onSuccess: () => {
        console.log('Order cancelled');
      }
    });
  };
  
  return (
    <div>
      {orders?.map(order => (
        <div key={order.id}>
          <p>{order.market_id} - {order.side} {order.outcome}</p>
          <p>Status: {order.status}</p>
          {order.status === 'pending' && (
            <button onClick={() => handleCancel(order.id)}>
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 5. Wallets

```tsx
import { useMyWallets, useConnectWallet } from '@/lib/api';

function WalletList() {
  const { data: wallets } = useMyWallets();
  const connectWallet = useConnectWallet();
  
  const handleConnect = async () => {
    // In real app, you'd get signature from wallet
    connectWallet.mutate({
      platform: 'polymarket',
      wallet_address: '0x123...',
      signature: 'signature...'
    });
  };
  
  return (
    <div>
      <button onClick={handleConnect}>Connect Wallet</button>
      {wallets?.map(wallet => (
        <div key={wallet.id}>
          <p>{wallet.platform}: {wallet.wallet_address}</p>
          <p>Primary: {wallet.is_primary ? 'Yes' : 'No'}</p>
        </div>
      ))}
    </div>
  );
}
```

### 6. Authentication

```tsx
import { useLogin, useRegister, useLogout } from '@/lib/api';

function LoginForm() {
  const login = useLogin();
  const logout = useLogout();
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    login.mutate({
      email: 'user@example.com',
      password: 'password123'
    }, {
      onSuccess: (data) => {
        console.log('Logged in:', data.user_id);
        // Redirect or update UI
      },
      onError: (error) => {
        console.error('Login failed:', error);
      }
    });
  };
  
  return (
    <div>
      <form onSubmit={handleLogin}>
        {/* Form fields */}
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## React Query Features

### Automatic Refetching

Markets and arbitrage opportunities refetch automatically:
- Markets: Every 10 seconds
- Arbitrage: Every 5 seconds
- Best Prices: Every 5 seconds

### Manual Refetching

```tsx
import { useMarkets } from '@/lib/api';

function MarketsList() {
  const { data, refetch } = useMarkets();
  
  return (
    <div>
      <button onClick={() => refetch()}>Refresh Markets</button>
      {/* Market list */}
    </div>
  );
}
```

### Loading & Error States

```tsx
import { useMarkets } from '@/lib/api';

function MarketsList() {
  const { data, isLoading, isError, error } = useMarkets();
  
  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;
  
  return <div>{/* Render markets */}</div>;
}
```

### Optimistic Updates

```tsx
import { usePlaceOrder, useMyOrders } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';

function OptimisticOrderForm() {
  const queryClient = useQueryClient();
  const placeOrder = usePlaceOrder();
  
  const handleSubmit = (orderData) => {
    placeOrder.mutate(orderData, {
      onMutate: async (newOrder) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: queryKeys.orders.all });
        
        // Snapshot previous value
        const previousOrders = queryClient.getQueryData(queryKeys.orders.my());
        
        // Optimistically update to show pending order
        queryClient.setQueryData(queryKeys.orders.my(), (old: any[]) => [
          ...old,
          { ...newOrder, id: 'temp', status: 'pending' }
        ]);
        
        return { previousOrders };
      },
      onError: (err, newOrder, context) => {
        // Rollback on error
        queryClient.setQueryData(queryKeys.orders.my(), context?.previousOrders);
      },
    });
  };
  
  return <form onSubmit={handleSubmit}>{/* Form fields */}</form>;
}
```

## React Query DevTools

The DevTools are automatically included in development mode. They appear as a floating icon in the bottom-right corner of your app.

To open: Click the React Query icon or press `Ctrl+Shift+D`

## Testing

### Mock API Responses

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

test('renders markets', async () => {
  const testQueryClient = createTestQueryClient();
  
  render(
    <QueryClientProvider client={testQueryClient}>
      <MarketsList />
    </QueryClientProvider>
  );
  
  // Test logic
});
```

## Performance Tips

1. **Use pagination** for large lists
2. **Implement infinite scroll** with `useInfiniteQuery` if needed
3. **Prefetch data** on hover for better UX
4. **Use selective invalidation** instead of invalidating all queries

## Next Steps

1. ✅ Install dependencies
2. ✅ Add QueryProvider to layout
3. ✅ Create API hooks
4. ✅ Update existing hooks (useTraderData)
5. 🔄 Create UI components that use these hooks
6. 🔄 Test end-to-end with backend running

## Troubleshooting

### CORS Errors

Make sure backend has CORS enabled for your frontend URL:

```env
# Backend .env
ALLOWED_ORIGINS=http://localhost:3000
```

### 401 Unauthorized

Check that auth token is being sent:

```tsx
import { apiClient } from '@/lib/api/client';

// Check if token is set
console.log('Auth token:', apiClient.getAuthToken());
```

### Network Errors

Verify backend is running and accessible:

```bash
curl http://localhost:8080/health
```

## Additional Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Axios Documentation](https://axios-http.com/docs/intro)


