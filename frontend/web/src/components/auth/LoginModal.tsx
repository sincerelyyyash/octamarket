'use client';

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { login, clearError } from '../../store/slices/authSlice';
import LoadingSpinner from '../ui/LoadingSpinner';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }: LoginModalProps) {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      onClose();
      setEmail('');
      setPassword('');
    }
  };

  const handleClose = () => {
    dispatch(clearError());
    setEmail('');
    setPassword('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[20px] p-6 md:p-8 max-w-md w-full relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-white text-[24px] md:text-[28px] font-semibold tracking-[-0.56px] mb-2">
          Login
        </h2>
        <p className="text-white/70 text-[12px] font-mono mb-6">
          Access your OctaMarket account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-white text-[14px] font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-[#4c4c4c] rounded-[10px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-white text-[14px] font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-[#4c4c4c] rounded-[10px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-[10px] px-4 py-3">
              <p className="text-red-400 text-[12px] font-mono">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-white/90 disabled:bg-white/50 text-black text-[14px] font-medium font-mono px-6 py-3 rounded-[10px] transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-white/70 text-[12px] font-mono">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-white hover:underline transition-colors"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

