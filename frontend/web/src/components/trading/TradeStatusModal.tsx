"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  updateTradeStatus,
  connectSSE,
  disconnectSSE,
} from "../../store/slices/tradesSlice";
import { tradesApi } from "../../lib/api/trades";
import { createSSEConnection } from "../../lib/sse/client";
import { TradeIntentStatus } from "../../types/trade";
import LoadingSpinner from "../ui/LoadingSpinner";

interface TradeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  intentId: string;
}

export default function TradeStatusModal({
  isOpen,
  onClose,
  intentId,
}: TradeStatusModalProps) {
  const dispatch = useAppDispatch();
  const tradeStatus = useAppSelector(
    (state) => state.trades.activeIntents[intentId]
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !intentId) return;

    // Connect to SSE stream
    const streamUrl = tradesApi.getTradeStreamUrl(intentId);

    const sseClient = createSSEConnection(streamUrl, {
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data) as TradeIntentStatus;
          dispatch(updateTradeStatus(data));
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      },
      onError: (err) => {
        console.error("SSE connection error:", err);
        setError("Failed to connect to trade updates");
      },
      onOpen: () => {
        setError(null);
      },
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    });

    dispatch(connectSSE({ intentId, client: sseClient }));

    // Cleanup on unmount
    return () => {
      dispatch(disconnectSSE(intentId));
    };
  }, [isOpen, intentId, dispatch]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-400";
      case "SUBMITTED":
        return "text-blue-400";
      case "FILLED":
        return "text-green-400";
      case "FAILED":
        return "text-red-400";
      default:
        return "text-white/70";
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "PENDING":
      case "SUBMITTED":
        return (
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/20 border-t-white" />
        );
      case "FILLED":
        return (
          <svg
            className="w-6 h-6 text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "FAILED":
        return (
          <svg
            className="w-6 h-6 text-red-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-white text-[24px] md:text-[28px] font-semibold tracking-[-0.56px] mb-6">
          Trade Status
        </h2>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/50 rounded-[8px] px-4 py-3 mb-4">
            <p className="text-red-400 text-[12px] font-mono">{error}</p>
          </div>
        ) : null}

        {!tradeStatus ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-white/70 text-[12px] font-mono mt-4">
              Loading trade status...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-center gap-4 py-6">
              {getStatusIcon(tradeStatus.status)}
              <div>
                <p
                  className={`text-[24px] font-semibold ${getStatusColor(
                    tradeStatus.status
                  )}`}
                >
                  {tradeStatus.status}
                </p>
                <p className="text-white/50 text-[11px] font-mono">
                  Trade Intent Status
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-[13px] font-mono">
                  Intent ID
                </span>
                <span className="text-white text-[13px] font-mono truncate max-w-[200px]">
                  {tradeStatus.intentId}
                </span>
              </div>

              {tradeStatus.venue && (
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[13px] font-mono">
                    Venue
                  </span>
                  <span className="text-white text-[13px] font-semibold">
                    {tradeStatus.venue}
                  </span>
                </div>
              )}

              {tradeStatus.orderId && (
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[13px] font-mono">
                    Order ID
                  </span>
                  <span className="text-white text-[13px] font-mono truncate max-w-[200px]">
                    {tradeStatus.orderId}
                  </span>
                </div>
              )}

              {tradeStatus.avgPrice !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[13px] font-mono">
                    Average Price
                  </span>
                  <span className="text-white text-[16px] font-semibold">
                    {(tradeStatus.avgPrice * 100).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* Fills */}
            {tradeStatus.fills && tradeStatus.fills.length > 0 && (
              <div>
                <h3 className="text-white text-[16px] font-semibold mb-3">
                  Fills
                </h3>
                <div className="space-y-2">
                  {tradeStatus.fills.map((fill, index) => (
                    <div
                      key={index}
                      className="bg-white/5 rounded-[8px] px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white text-[13px] font-mono">
                          Qty: {fill.qty}
                        </p>
                        <p className="text-white/50 text-[11px] font-mono">
                          {new Date(fill.ts).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-white text-[14px] font-semibold">
                        {(fill.px * 100).toFixed(2)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error/Reason */}
            {(tradeStatus.error || tradeStatus.reason) && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-[8px] px-4 py-3">
                <p className="text-red-400 text-[12px] font-mono">
                  {tradeStatus.error || tradeStatus.reason}
                </p>
              </div>
            )}

            {/* Timestamps */}
            <div className="space-y-2 pt-4 border-t border-[#4c4c4c]/50">
              {tradeStatus.submittedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-[11px] font-mono">
                    Submitted
                  </span>
                  <span className="text-white/70 text-[11px] font-mono">
                    {new Date(tradeStatus.submittedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {tradeStatus.filledAt && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-[11px] font-mono">
                    Filled
                  </span>
                  <span className="text-white/70 text-[11px] font-mono">
                    {new Date(tradeStatus.filledAt).toLocaleString()}
                  </span>
                </div>
              )}
              {tradeStatus.failedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-[11px] font-mono">
                    Failed
                  </span>
                  <span className="text-white/70 text-[11px] font-mono">
                    {new Date(tradeStatus.failedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
