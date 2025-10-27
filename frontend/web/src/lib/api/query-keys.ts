// Query key factory for React Query
// This ensures type-safe and consistent query keys across the app

export const queryKeys = {
  // Markets
  markets: {
    all: ['markets'] as const,
    list: (params?: { page?: number; limit?: number }) => 
      ['markets', 'list', params] as const,
    detail: (eventFingerprint: string) => 
      ['markets', 'detail', eventFingerprint] as const,
    sources: (eventFingerprint: string) => 
      ['markets', 'sources', eventFingerprint] as const,
    bestPrice: (eventFingerprint: string) => 
      ['markets', 'bestPrice', eventFingerprint] as const,
  },

  // Arbitrage
  arbitrage: {
    all: ['arbitrage'] as const,
    opportunities: (params?: { page?: number; limit?: number }) => 
      ['arbitrage', 'opportunities', params] as const,
    detail: (id: string) => 
      ['arbitrage', 'detail', id] as const,
  },

  // Leaders
  leaders: {
    all: ['leaders'] as const,
    list: () => ['leaders', 'list'] as const,
    detail: (leaderId: string) => 
      ['leaders', 'detail', leaderId] as const,
  },

  // Wallet Leaderboard
  walletLeaderboard: {
    all: ['walletLeaderboard'] as const,
    list: (params?: { page?: number; limit?: number }) => 
      ['walletLeaderboard', 'list', params] as const,
  },

  // Wallet Trades
  walletTrades: {
    all: ['walletTrades'] as const,
    list: (walletAddress: string, params?: { page?: number; limit?: number }) => 
      ['walletTrades', 'list', walletAddress, params] as const,
  },

  // Orders
  orders: {
    all: ['orders'] as const,
    my: (params?: { page?: number; limit?: number }) => 
      ['orders', 'my', params] as const,
  },

  // User Wallets
  userWallets: {
    all: ['userWallets'] as const,
    my: () => ['userWallets', 'my'] as const,
  },

  // Copy Trading
  follows: {
    all: ['follows'] as const,
    my: () => ['follows', 'my'] as const,
  },
};


