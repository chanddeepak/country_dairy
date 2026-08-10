'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Star, Trash2, Pencil, BadgeCheck, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { API_URL, resolveStorefrontImageUrl } from '../../lib/constants';
import ReviewForm from './ReviewForm';

interface ApiReview {
  id: string;
  userId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  mediaUrls: string[];
  mediaTypes?: ('IMAGE' | 'VIDEO')[];
  isVerifiedPurchase: boolean;
  createdAt: string;
  editedAt?: string | null;
  user?: { name: string | null } | null;
}

interface ReviewPage {
  averageRating: number;
  totalReviews: number;
  distribution: { stars: number; count: number }[];
  reviews: ApiReview[];
  page: number;
  totalPages: number;
}

interface ReviewSectionProps {
  productId: string;
  token: string | null;
  currentUserId?: string | null;
  onRequestSignIn: () => void;
  /** Bubbles the aggregate up so the page header can show it. */
  onSummaryChange?: (summary: { averageRating: number; totalReviews: number }) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ReviewSection({
  productId,
  token,
  currentUserId,
  onRequestSignIn,
  onSummaryChange,
}: ReviewSectionProps) {
  const [data, setData] = useState<ReviewPage | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  // Set when editing an existing review rather than writing a new one.
  const [editing, setEditing] = useState<ApiReview | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; type: 'IMAGE' | 'VIDEO' } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/products/${productId}/reviews?page=${page}&pageSize=5`);
      if (!res.ok) throw new Error('Could not load reviews');
      const json: ReviewPage = await res.json();
      setData(json);
      onSummaryChange?.({ averageRating: json.averageRating, totalReviews: json.totalReviews });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [productId, page, onSummaryChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      const res = await fetch(`${API_URL}/products/${productId}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not delete the review');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the review');
    } finally {
      setDeletingId(null);
    }
  };

  const total = data?.totalReviews ?? 0;
  const average = data?.averageRating ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <h2 className="font-serif font-black text-2xl text-[#2A2A2A]">Customer Reviews</h2>

        {/* Compact trigger. The form used to sit inline and pushed the actual
            reviews below the fold. */}
        {token ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-2.5 px-5 rounded-lg text-sm transition shrink-0"
          >
            {data?.reviews.some((r) => r.userId === currentUserId)
              ? 'Write another review'
              : 'Write a Review'}
          </button>
        ) : (
          <button
            onClick={onRequestSignIn}
            className="border-2 border-[#3A6038] text-[#3A6038] hover:bg-[#3A6038]/5 font-bold py-2.5 px-5 rounded-lg text-sm transition shrink-0"
          >
            Sign in to review
          </button>
        )}
      </div>

      {isLoading && !data ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[#6b6661] justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 font-bold">{error}</p>
      ) : total === 0 ? (
        <div className="bg-[#FAF8F3] border border-stone-200 rounded-xl p-8 text-center">
          <Star className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-[#2A2A2A] mb-1">No reviews yet</p>
          <p className="text-xs text-[#6b6661]">
            Be the first to share how you found this product.
          </p>
        </div>
      ) : (
        <>
          {/* Summary + histogram */}
          <div className="flex flex-col sm:flex-row gap-6 bg-[#FAF8F3] border border-stone-200 rounded-xl p-6">
            <div className="text-center shrink-0">
              <div className="text-4xl font-black text-[#2A2A2A]">{average.toFixed(1)}</div>
              <div className="flex justify-center gap-0.5 my-1.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(average) ? 'fill-[#C59B27] text-[#C59B27]' : 'text-stone-300'
                    }`}
                  />
                ))}
              </div>
              <div className="text-xs text-[#6b6661]">
                {total} {total === 1 ? 'review' : 'reviews'}
              </div>
            </div>

            <div className="flex-1 space-y-1.5 self-center">
              {data?.distribution.map((row) => (
                <div key={row.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-[#6b6661]">{row.stars}</span>
                  <Star className="h-3 w-3 fill-[#C59B27] text-[#C59B27]" />
                  <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C59B27] rounded-full"
                      style={{ width: total ? `${(row.count / total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="w-6 text-right text-[#6b6661]">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review list */}
          <div className="space-y-5">
            {data?.reviews.map((review) => (
              <div key={review.id} className="border-b border-stone-100 pb-5 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < review.rating ? 'fill-[#C59B27] text-[#C59B27]' : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-sm text-[#2A2A2A]">
                        {review.user?.name || 'Verified Customer'}
                      </span>
                      {review.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          <BadgeCheck className="h-3 w-3" /> Verified purchase
                        </span>
                      )}
                    </div>

                    {review.title && (
                      <h4 className="font-bold text-[#2A2A2A] mt-1.5">{review.title}</h4>
                    )}
                    {review.comment && (
                      <p className="text-sm text-[#6b6661] mt-1 leading-relaxed">{review.comment}</p>
                    )}
                    <div className="text-[11px] text-stone-400 mt-1.5">
                      {formatDate(review.createdAt)}
                      {review.editedAt && ' · edited'}
                    </div>
                  </div>

                  {/* A customer can edit or withdraw their own review. */}
                  {currentUserId && review.userId === currentUserId && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditing(review);
                          setShowForm(true);
                        }}
                        className="text-stone-400 hover:text-[#3A6038] transition p-1"
                        title="Edit your review"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(review.id)}
                        disabled={deletingId === review.id}
                        className="text-stone-400 hover:text-red-600 transition p-1 disabled:opacity-50"
                        title="Delete your review"
                      >
                        {deletingId === review.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Attachments. These rendered as broken image icons because the
                    stored value is a relative bucket path, not a full URL. */}
                {review.mediaUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {review.mediaUrls.map((url, idx) => {
                      const type = review.mediaTypes?.[idx] ?? 'IMAGE';
                      const resolved = resolveStorefrontImageUrl(url);

                      return (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setLightbox({ url: resolved, type })}
                          className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-50 hover:border-[#3A6038] transition"
                        >
                          {type === 'VIDEO' ? (
                            <>
                              <video src={resolved} className="w-full h-full object-cover" muted preload="metadata" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="h-5 w-5 text-white fill-white" />
                              </span>
                            </>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolved}
                              alt={`Review attachment ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="p-2 rounded-lg border border-stone-200 text-[#2A2A2A] hover:bg-stone-50 disabled:opacity-40 transition"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs font-bold text-[#6b6661]">
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                ) : (
                  `Page ${data?.page} of ${data?.totalPages}`
                )}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
                disabled={page === (data?.totalPages ?? 1) || isLoading}
                className="p-2 rounded-lg border border-stone-200 text-[#2A2A2A] hover:bg-stone-50 disabled:opacity-40 transition"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Write-a-review modal */}
      {showForm && token && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => {
            setShowForm(false);
            setEditing(null);
          }}
        >
          <div className="w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="absolute -top-3 -right-3 z-10 bg-white border border-stone-200 rounded-full p-1.5 text-stone-500 hover:text-stone-900 shadow-lg transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <ReviewForm
                productId={productId}
                token={token}
                existingReview={editing}
                onSubmitted={() => {
                  setShowForm(false);
                  setEditing(null);
                  setPage(1);
                  load();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Attachment lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          {lightbox.type === 'VIDEO' ? (
            <video
              src={lightbox.url}
              className="max-h-[85vh] max-w-full rounded-lg"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt="Review attachment"
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
