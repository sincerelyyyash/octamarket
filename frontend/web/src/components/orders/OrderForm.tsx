'use client';

import { useState } from 'react';
import { usePlaceOrder } from '@/lib/api';
import { PlaceOrderRequest } from '@/lib/api/types';

interface OrderFormProps {
  marketId?: string;
  platform?: string;
  eventTitle?: string;
  onSuccess?: () => void;
}

export function OrderForm({ marketId, platform, eventTitle, onSuccess }: OrderFormProps) {
  const [formData, setFormData] = useState<PlaceOrderRequest>({
    market_id: marketId || '',
    platform: platform || 'polymarket',
    side: 'buy',
    outcome: 'Yes',
    price: 0.50,
    amount: 100,
    order_type: 'limit',
  });

  const placeOrder = usePlaceOrder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    placeOrder.mutate(formData, {
      onSuccess: (data) => {
        console.log('Order placed:', data.order_id);
        if (onSuccess) onSuccess();
        // Reset form
        setFormData({
          ...formData,
          price: 0.50,
          amount: 100,
        });
      },
      onError: (error) => {
        console.error('Order failed:', error);
      }
    });
  };

  const updateField = (field: keyof PlaceOrderRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const estimatedCost = formData.side === 'buy' 
    ? formData.amount * formData.price 
    : formData.amount * (1 - formData.price);

  const estimatedPayout = formData.amount;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">📝 Place Order</h2>
      
      {eventTitle && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-400 mb-1">Market</div>
          <div className="text-white font-semibold">{eventTitle}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Market ID (if not pre-filled) */}
        {!marketId && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Market ID *
            </label>
            <input
              type="text"
              value={formData.market_id}
              onChange={(e) => updateField('market_id', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              placeholder="Enter market ID"
              required
            />
          </div>
        )}

        {/* Platform */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Platform
          </label>
          <select
            value={formData.platform}
            onChange={(e) => updateField('platform', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 capitalize"
          >
            <option value="polymarket">Polymarket</option>
            <option value="kalshi">Kalshi</option>
            <option value="augur">Augur</option>
            <option value="thales">Thales</option>
            <option value="omen">Omen</option>
          </select>
        </div>

        {/* Side and Outcome */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Side
            </label>
            <select
              value={formData.side}
              onChange={(e) => updateField('side', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Outcome
            </label>
            <select
              value={formData.outcome}
              onChange={(e) => updateField('outcome', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Price (decimal)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="0.99"
            value={formData.price}
            onChange={(e) => updateField('price', parseFloat(e.target.value) || 0.01)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            required
          />
          <div className="text-xs text-gray-400 mt-1">
            {(formData.price * 100).toFixed(2)}¢
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount (shares)
          </label>
          <input
            type="number"
            step="10"
            min="1"
            value={formData.amount}
            onChange={(e) => updateField('amount', parseFloat(e.target.value) || 1)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            required
          />
        </div>

        {/* Order Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Order Type
          </label>
          <select
            value={formData.order_type}
            onChange={(e) => updateField('order_type', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="limit">Limit Order</option>
            <option value="market">Market Order</option>
          </select>
        </div>

        {/* Order Summary */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="text-sm font-semibold text-white mb-3">Order Summary</div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Side:</span>
            <span className={`font-semibold ${
              formData.side === 'buy' ? 'text-green-400' : 'text-red-400'
            }`}>
              {formData.side.toUpperCase()} {formData.outcome}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Shares:</span>
            <span className="text-white font-mono">{formData.amount}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price per share:</span>
            <span className="text-white font-mono">${formData.price.toFixed(2)}</span>
          </div>

          <div className="border-t border-gray-700 pt-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estimated Cost:</span>
              <span className="text-yellow-400 font-bold">${estimatedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Potential Payout:</span>
              <span className="text-green-400 font-bold">${estimatedPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Potential Profit:</span>
              <span className="text-green-400 font-bold">
                ${(estimatedPayout - estimatedCost).toFixed(2)} 
                ({((estimatedPayout - estimatedCost) / estimatedCost * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {placeOrder.isError && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
            <div className="text-red-500 font-semibold mb-1">Order Failed</div>
            <div className="text-gray-300 text-sm">
              {placeOrder.error?.message || 'Failed to place order'}
            </div>
          </div>
        )}

        {/* Success Message */}
        {placeOrder.isSuccess && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
            <div className="text-green-500 font-semibold mb-1">✅ Order Placed!</div>
            <div className="text-gray-300 text-sm">
              Your order has been submitted successfully.
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={placeOrder.isPending || !formData.market_id}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02]"
        >
          {placeOrder.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              <span>Placing Order...</span>
            </span>
          ) : (
            `Place ${formData.side.toUpperCase()} Order`
          )}
        </button>
      </form>
    </div>
  );
}


