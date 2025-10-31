'use client';

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { register, clearError } from '../../store/slices/authSlice';
import LoadingSpinner from '../ui/LoadingSpinner';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(register({ name, email, password }));
    if (register.fulfilled.match(result)) {
      onClose();
      setName('');
      setEmail('');
      setPassword('');
    }
  };

  const handleClose = () => {
    dispatch(clearError());
    setName('');
    setEmail('');
    setPassword('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 max-w-md w-full relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-white text-[24px] md:text-[28px] font-semibold tracking-[-0.56px] mb-2">
          Create Account
        </h2>
        <p className="text-white/70 text-[12px] font-mono mb-6">
          Join OctaMarket and start trading smarter
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-white text-[14px] font-medium mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-white text-[14px] font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
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
              className="w-full bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
              placeholder="••••••••"
              required
              minLength={8}
            />
            <p className="text-white/50 text-[11px] font-mono mt-1">
              Minimum 8 characters
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-[8px] px-4 py-3">
              <p className="text-red-400 text-[12px] font-mono">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-white/90 disabled:bg-white/50 text-black text-[14px] font-medium font-mono px-6 py-3 rounded-[8px] transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-white/70 text-[12px] font-mono">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-white hover:underline transition-colors"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

