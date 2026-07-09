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
        <div className="text-5xl font-black text-[#2A2A2A] mb-1">{averageRating.toFixed(1)}</div>
        <StarRating rating={averageRating} size="md" />
        <p className="text-xs text-[#6b6661] mt-1">{totalReviews} reviews</p>
      </div>

      {/* Distribution Bars */}
      <div className="flex-1 w-full space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = dist[star] || 0;
          const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2A2A2A] w-3">{star}</span>
              <StarRating rating={star} maxStars={1} size="sm" />
              <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#C59B27] h-full rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-[#6b6661] w-6 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
