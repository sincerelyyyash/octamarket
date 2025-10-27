'use client';

import { useMyOrders, useCancelOrder } from '@/lib/api';
import { Order } from '@/lib/api/types';
import { useState } from 'react';

export function MyOrders() {
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const { data: orders, isLoading, isError, error } = useMyOrders({ page, limit });
  const cancelOrder = useCancelOrder();

  const handleCancel = (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      cancelOrder.mutate(orderId, {
        onSuccess: () => {
          console.log('Order cancelled');
        },
        onError: (error) => {
          console.error('Cancel failed:', error);
        }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500';
      case 'filled': return 'bg-green-500/20 text-green-500';
      case 'partially_filled': return 'bg-blue-500/20 text-blue-500';
      case 'cancelled': return 'bg-gray-500/20 text-gray-500';
      case 'failed': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getSideColor = (side: string) => {
    return side.toLowerCase() === 'buy' ? 'text-green-400' : 'text-red-400';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-32"></div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <h3 className="text-red-500 font-semibold mb-2">Error Loading Orders</h3>
        <p className="text-gray-300">{error?.message || 'Failed to load orders'}</p>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold text-white mb-2">No Orders Yet</h3>
        <p className="text-gray-400">
          Your order history will appear here once you place your first order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          My Orders ({orders.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-400 px-4">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={orders.length < limit}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map(order => (
          <div 
            key={order.id}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                  <span className="text-gray-400 text-sm capitalize">{order.platform}</span>
                  <span className={`font-semibold ${getSideColor(order.side)}`}>
                    {order.side.toUpperCase()} {order.outcome}
                  </span>
                </div>
                <div className="text-gray-400 text-sm">
                  Market: <span className="text-white font-mono text-xs">{order.market_id}</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-gray-400 text-xs mb-1">
                  {formatDate(order.created_at)}
                </div>
                {order.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(order.id)}
                    disabled={cancelOrder.isPending}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {cancelOrder.isPending ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-gray-400 text-xs mb-1">Price</div>
                <div className="text-white font-mono font-semibold">
                  ${order.price.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Amount</div>
                <div className="text-white font-mono font-semibold">
                  {order.amount} shares
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Type</div>
                <div className="text-white capitalize">
                  {order.order_type}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Total</div>
                <div className="text-purple-400 font-mono font-semibold">
                  ${(order.price * order.amount).toFixed(2)}
                </div>
              </div>
            </div>

            {order.filled_amount && order.filled_amount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    Filled: {order.filled_amount} shares
                    {order.avg_fill_price && ` @ $${order.avg_fill_price.toFixed(2)}`}
                  </span>
                  <span className="text-green-400">
                    {((order.filled_amount / order.amount) * 100).toFixed(1)}% filled
                  </span>
                </div>
              </div>
            )}

            {order.tx_hash && (
              <div className="mt-2 text-xs text-gray-400">
                Tx: <span className="text-blue-400 font-mono">{order.tx_hash.substring(0, 20)}...</span>
              </div>
            )}

            {order.error_message && (
              <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded p-3">
                <div className="text-red-400 text-sm">{order.error_message}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


