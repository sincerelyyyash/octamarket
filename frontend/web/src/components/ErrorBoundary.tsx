'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#090C15] flex items-center justify-center px-4">
          <div className="bg-black border border-[#4c4c4c] rounded-[20px] p-6 md:p-8 max-w-lg w-full">
            <h2 className="text-white text-[24px] font-semibold tracking-[-0.48px] mb-3">
              Something went wrong
            </h2>
            <p className="text-white/70 text-[12px] font-mono leading-[1.6] mb-6">
              We encountered an error while loading this page. Please try refreshing the page or
              contact support if the problem persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-white px-6 py-3 rounded-[10px] text-black text-[14px] font-medium font-mono hover:bg-white/90 transition-colors cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

