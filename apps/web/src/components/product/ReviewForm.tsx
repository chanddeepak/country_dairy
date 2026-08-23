'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Play } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { API_URL, resolveStorefrontImageUrl } from '../../lib/constants';
import {
  ACCEPTED_MEDIA_ACCEPT_ATTR,
  MAX_REVIEW_MEDIA,
  uploadMedia,
  validateMediaFile,
  type UploadedMedia,
} from '../../lib/uploadMedia';

interface ExistingReview {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  mediaUrls: string[];
  mediaTypes?: ('IMAGE' | 'VIDEO')[];
}

interface ReviewFormProps {
  productId: string;
  token: string;
  /** When present the form edits this review instead of creating one. */
  existingReview?: ExistingReview | null;
  onSubmitted: () => void;
}

export default function ReviewForm({
  productId,
  token,
  existingReview,
  onSubmitted,
}: ReviewFormProps) {
  const isEditing = !!existingReview;

  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? '');
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [media, setMedia] = useState<UploadedMedia[]>(
    // Already-uploaded attachments have no local blob, so the stored URL is
    // its own preview.
    (existingReview?.mediaUrls ?? []).map((url, i) => ({
      url,
      mediaType: existingReview?.mediaTypes?.[i] ?? 'IMAGE',
      previewUrl: resolveStorefrontImageUrl(url),
    })),
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only blob: previews need revoking; a stored URL is not an object URL.
  useEffect(() => {
    return () =>
      media.forEach((m) => {
        if (m.previewUrl.startsWith('blob:')) URL.revokeObjectURL(m.previewUrl);
      });
  }, [media]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');

    const remaining = MAX_REVIEW_MEDIA - media.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_REVIEW_MEDIA} files.`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      for (const file of selected) {
        const problem = validateMediaFile(file);
        if (problem) {
          setError(problem);
          continue;
        }

        const uploaded = await uploadMedia(file, token);
        setMedia((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (idx: number) => {
    setMedia((prev) => {
      if (prev[idx].previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a star rating.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const endpoint = isEditing
        ? `${API_URL}/products/${productId}/reviews/${existingReview!.id}`
        : `${API_URL}/products/${productId}/reviews`;

      const res = await fetch(endpoint, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rating,
          title: title || undefined,
          comment: comment || undefined,
          mediaUrls: media.map((m) => m.url),
          mediaTypes: media.map((m) => m.mediaType),
        }),
      });

      if (res.ok) {
        if (!isEditing) {
          setRating(0);
          setTitle('');
          setComment('');
          setMedia([]);
        }
        onSubmitted();
      } else {
        const body = await res.json().catch(() => null);
        setError(
          Array.isArray(body?.message)
            ? body.message.join('. ')
            : body?.message || 'Failed to submit review. Please try again.',
        );
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--ivory)] border border-[var(--line)] rounded-sm p-6 space-y-4">
      <h4 className="font-serif font-light text-lg text-[var(--ink)]">
        {isEditing ? 'Edit your review' : 'Write a Review'}
      </h4>

      {error && <p className="text-xs text-[var(--danger)] font-bold">{error}</p>}

      <div>
        <label className="text-xs font-bold text-[var(--ink)] block mb-1">Your Rating:</label>
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
      </div>

      <div>
        <label className="text-xs font-bold text-[var(--ink)] block mb-1">Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Extremely Fresh!"
          className="w-full bg-white border border-[var(--line)] px-4 py-2.5 rounded-sm text-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)]"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-[var(--ink)] block mb-1">Comment:</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Share your experience..."
          className="w-full bg-white border border-[var(--line)] px-4 py-2.5 rounded-sm text-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)] resize-none"
        />
      </div>

      {/* Photos and video */}
      <div>
        <label className="text-xs font-bold text-[var(--ink)] block mb-1">
          Add photos or a video{' '}
          <span className="font-medium text-[var(--ink-soft)]">
            (optional, up to {MAX_REVIEW_MEDIA})
          </span>
        </label>

        <div className="flex flex-wrap gap-2.5">
          {media.map((m, idx) => (
            <div
              key={m.url}
              className="relative w-20 h-20 rounded-sm overflow-hidden border border-[var(--line)] bg-white group"
            >
              {m.mediaType === 'VIDEO' ? (
                <>
                  <video src={m.previewUrl} className="w-full h-full object-cover" muted />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-5 w-5 text-white fill-white" />
                  </div>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
              )}

              <button
                type="button"
                onClick={() => removeMedia(idx)}
                className="absolute top-0.5 right-0.5 bg-[var(--forest)]/70 hover:bg-[var(--danger)] text-white rounded-full p-0.5 transition"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {media.length < MAX_REVIEW_MEDIA && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 rounded-sm border-2 border-dashed border-[var(--line)] hover:border-[var(--forest)] hover:bg-[var(--forest)]/5 flex flex-col items-center justify-center gap-1 text-[var(--ink-soft)] hover:text-[var(--forest)] transition disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px] font-bold">Add</span>
                </>
              )}
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MEDIA_ACCEPT_ATTR}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <p className="text-[10px] text-[var(--ink-soft)] mt-1.5">
          JPG, PNG or WebP up to 15MB · MP4 or MOV up to 100MB
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting || uploading}
        className="bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-2.5 px-6 rounded-sm text-sm transition disabled:opacity-50 flex items-center gap-2"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Submit Review'}
      </button>

      <p className="text-[10px] text-[var(--ink-soft)]">
        Your review appears straight away. We may remove it later if it breaks
        our review guidelines.
      </p>
    </form>
  );
}
