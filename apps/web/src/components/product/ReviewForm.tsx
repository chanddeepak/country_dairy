'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Play } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { API_URL } from '../../lib/constants';
import {
  ACCEPTED_MEDIA_ACCEPT_ATTR,
  MAX_REVIEW_MEDIA,
  uploadMedia,
  validateMediaFile,
  type UploadedMedia,
} from '../../lib/uploadMedia';

interface ReviewFormProps {
  productId: string;
  token: string;
  onSubmitted: () => void;
}

export default function ReviewForm({ productId, token, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview URLs are object URLs; release them so the blobs can be collected.
  useEffect(() => {
    return () => media.forEach((m) => URL.revokeObjectURL(m.previewUrl));
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
      URL.revokeObjectURL(prev[idx].previewUrl);
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
      const res = await fetch(`${API_URL}/products/${productId}/reviews`, {
        method: 'POST',
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
        setRating(0);
        setTitle('');
        setComment('');
        setMedia([]);
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

      {/* Photos and video */}
      <div>
        <label className="text-xs font-bold text-[#2A2A2A] block mb-1">
          Add photos or a video{' '}
          <span className="font-medium text-[#6b6661]">
            (optional, up to {MAX_REVIEW_MEDIA})
          </span>
        </label>

        <div className="flex flex-wrap gap-2.5">
          {media.map((m, idx) => (
            <div
              key={m.url}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200 bg-white group"
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
                className="absolute top-0.5 right-0.5 bg-stone-900/70 hover:bg-red-600 text-white rounded-full p-0.5 transition"
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
              className="w-20 h-20 rounded-lg border-2 border-dashed border-stone-300 hover:border-[#3A6038] hover:bg-[#3A6038]/5 flex flex-col items-center justify-center gap-1 text-[#6b6661] hover:text-[#3A6038] transition disabled:opacity-50"
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

        <p className="text-[10px] text-[#6b6661] mt-1.5">
          JPG, PNG or WebP up to 15MB · MP4 or MOV up to 100MB
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting || uploading}
        className="bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>

      <p className="text-[10px] text-[#6b6661]">
        Reviews appear once a moderator approves them.
      </p>
    </form>
  );
}
