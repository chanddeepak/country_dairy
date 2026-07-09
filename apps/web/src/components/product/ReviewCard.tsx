'use client';

import React from 'react';
import StarRating from '../ui/StarRating';

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title?: string;
    comment?: string;
    mediaUrls?: string[];
    createdAt: string;
    user?: { name?: string };
  };
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const date = new Date(review.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="border-b border-stone-100 pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} size="sm" />
          <span className="text-xs font-bold text-[#2A2A2A]">{review.user?.name || 'Customer'}</span>
        </div>
        <span className="text-[11px] text-[#6b6661]">{date}</span>
      </div>
      {review.title && (
        <h4 className="font-bold text-sm text-[#2A2A2A] mb-1">&ldquo;{review.title}&rdquo;</h4>
      )}
      {review.comment && (
        <p className="text-xs text-[#6b6661] leading-relaxed">{review.comment}</p>
      )}
      {review.mediaUrls && review.mediaUrls.length > 0 && (
        <div className="flex gap-2 mt-3">
          {review.mediaUrls.map((url, i) => (
            <div key={i} className="w-16 h-16 bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
              <img src={url} alt={`Review media ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
