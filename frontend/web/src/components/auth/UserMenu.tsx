"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { logout } from "../../store/slices/authSlice";
import Link from "next/link";

export default function UserMenu() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-white/10 transition-colors"
      >
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
          <span className="text-black text-[12px] font-semibold">
            {user ? getInitials(user.name) : "U"}
          </span>
        </div>
        <span className="text-white text-[14px] font-medium hidden sm:inline">
          {user?.name}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-black border border-[#4c4c4c] rounded-[8px] shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#4c4c4c]">
            <p className="text-white text-[14px] font-medium">{user?.name}</p>
            <p className="text-white/70 text-[12px] font-mono truncate">
              {user?.email}
            </p>
          </div>

          <div className="py-2">
            <Link
              href="/copy-trading/my-follows"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 text-[14px] font-mono transition-colors"
            >
              My Follows
            </Link>
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 text-[14px] font-mono transition-colors"
            >
              Profile Settings
            </Link>
          </div>

          <div className="border-t border-[#4c4c4c] py-2">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-red-400 hover:bg-white/10 text-[14px] font-mono transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
