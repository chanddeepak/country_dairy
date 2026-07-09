'use client';

import React, { useState } from 'react';
import StarRating from '../ui/StarRating';
import { API_URL } from '../../lib/constants';

interface ReviewFormProps {
  productId: string;
  token: string;
  onSubmitted: () => void;
}

export default function ReviewForm({ productId, token, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, title, comment, mediaUrls: [] }),
      });
      if (res.ok) {
        setRating(0); setTitle(''); setComment('');
        onSubmitted();
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#FAF8F3] border border-stone-200 rounded-xl p-6 space-y-4">
      <h4 className="font-serif font-black text-lg text-[#2A2A2A]">Write a Review</h4>

      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}

      <div>
        <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Your Rating:</label>
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
      </div>

      <div>
        <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Extremely Fresh!"
          className="w-full bg-white border border-stone-200 px-4 py-2.5 rounded-lg text-sm text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038]"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Comment:</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Share your experience..."
          className="w-full bg-white border border-stone-200 px-4 py-2.5 rounded-lg text-sm text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}
