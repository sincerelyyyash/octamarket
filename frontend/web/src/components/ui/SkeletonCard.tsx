import React from 'react';

interface SkeletonCardProps {
  className?: string;
}

export default function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`bg-black border border-[#4c4c4c] rounded-[20px] p-4 md:p-6 animate-pulse ${className}`}
    >
      <div className="space-y-4">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
        <div className="space-y-2">
          <div className="h-3 bg-white/10 rounded" />
          <div className="h-3 bg-white/10 rounded w-5/6" />
        </div>
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-white/10 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

