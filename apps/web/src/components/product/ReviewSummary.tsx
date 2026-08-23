'use client';

import React from 'react';
import StarRating from '../ui/StarRating';

interface ReviewSummaryProps {
  averageRating: number;
  totalReviews: number;
  distribution?: Record<number, number>; // { 5: 10, 4: 2, 3: 0, 2: 0, 1: 0 }
}

export default function ReviewSummary({ averageRating, totalReviews, distribution }: ReviewSummaryProps) {
  // Default distribution if not provided
  const dist = distribution || {
    5: Math.round(totalReviews * 0.7),
    4: Math.round(totalReviews * 0.2),
    3: Math.round(totalReviews * 0.05),
    2: Math.round(totalReviews * 0.03),
    1: Math.round(totalReviews * 0.02),
  };

  return (
    <div className="flex flex-col sm:flex-row gap-8 items-start">
      {/* Average Score */}
      <div className="text-center sm:text-left">
        <div className="text-5xl font-black text-[var(--ink)] mb-1">{averageRating.toFixed(1)}</div>
        <StarRating rating={averageRating} size="md" />
        <p className="text-xs text-[var(--ink-soft)] mt-1">{totalReviews} reviews</p>
      </div>

      {/* Distribution Bars */}
      <div className="flex-1 w-full space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = dist[star] || 0;
          const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--ink)] w-3">{star}</span>
              <StarRating rating={star} maxStars={1} size="sm" />
              <div className="flex-1 bg-[var(--cream)] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[var(--brass)] h-full rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-[var(--ink-soft)] w-6 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
