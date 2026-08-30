'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 'sm',
  interactive = false,
  onChange,
}: StarRatingProps) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    /*
     * Read-only, this is one value rather than five controls — a screen reader
     * announcing "button, button, button…" describes the markup instead of the
     * rating. Interactive, each star is a real choice and says which one it is.
     */
    <div
      className="flex items-center gap-0.5"
      {...(interactive
        ? { role: 'group', 'aria-label': 'Your rating' }
        : { role: 'img', 'aria-label': `${rating} out of ${maxStars} stars` })}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.floor(rating);
        const half = !filled && i < rating;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            // The group above carries the value when this is only a display.
            aria-hidden={!interactive}
            aria-label={interactive ? `${i + 1} star${i === 0 ? '' : 's'}` : undefined}
            aria-pressed={interactive ? i < rating : undefined}
            onClick={() => interactive && onChange?.(i + 1)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          >
            <Star
              className={`${sizeClass} ${
                filled
                  ? 'fill-[var(--brass)] text-[var(--brass)]'
                  : half
                    ? 'fill-[rgb(var(--brass-rgb)/0.5)] text-[var(--brass)]'
                    : 'fill-[var(--line)] text-[var(--line)]'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
