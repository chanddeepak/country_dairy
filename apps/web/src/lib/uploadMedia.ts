// Customer media uploads (review photos and video).
//
// Goes through the same pre-signed URL flow the admin console uses, so files
// land in Supabase Storage rather than being posted through the API.
import { API_URL } from './constants';

export type MediaType = 'IMAGE' | 'VIDEO';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ACCEPTED_MEDIA_ACCEPT_ATTR = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',');

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_REVIEW_MEDIA = 5;

export interface UploadedMedia {
  url: string;
  mediaType: MediaType;
  /** Object URL for local preview; revoke when the component unmounts. */
  previewUrl: string;
}

export function mediaTypeOf(file: File): MediaType | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'IMAGE';
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return 'VIDEO';
  return null;
}

/** Returns an error message, or null when the file is acceptable. */
export function validateMediaFile(file: File): string | null {
  const kind = mediaTypeOf(file);
  if (!kind) {
    return `"${file.name}" is not a supported format. Use JPG, PNG, WebP, MP4 or MOV.`;
  }

  const limit = kind === 'VIDEO' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return `"${file.name}" is larger than ${Math.round(limit / (1024 * 1024))}MB.`;
  }

  return null;
}

/**
 * Shrinks a photo before upload. Skipped for video, which the browser cannot
 * usefully re-encode and which would block the main thread trying.
 */
async function compressImage(file: File): Promise<Blob> {
  if (typeof document === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    );
    return blob ?? file;
  } catch {
    // A format the browser cannot decode is uploaded untouched.
    return file;
  }
}

export async function uploadMedia(
  file: File,
  token: string,
  bucket = 'review-media',
): Promise<UploadedMedia> {
  const kind = mediaTypeOf(file);
  if (!kind) throw new Error('Unsupported file type');

  const isVideo = kind === 'VIDEO';
  const body: Blob = isVideo ? file : await compressImage(file);
  const contentType = isVideo ? file.type : 'image/webp';
  const filename = isVideo ? file.name : file.name.replace(/\.[^.]+$/, '.webp');

  const presignRes = await fetch(
    `${API_URL}/media/presigned-url?filename=${encodeURIComponent(filename)}` +
      `&contentType=${encodeURIComponent(contentType)}&bucket=${bucket}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!presignRes.ok) {
    throw new Error('Could not start the upload. Please try again.');
  }

  const { uploadUrl, fileUrl, method = 'PUT' } = await presignRes.json();

  if (method === 'PUT') {
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!put.ok) throw new Error('Upload failed. Please try again.');
    return { url: fileUrl, mediaType: kind, previewUrl: URL.createObjectURL(file) };
  }

  // Local multipart fallback when object storage is not configured.
  const formData = new FormData();
  formData.append('file', body, filename);

  const post = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!post.ok) throw new Error('Upload failed. Please try again.');

  const data = await post.json();
  return {
    url: data.url || fileUrl,
    mediaType: kind,
    previewUrl: URL.createObjectURL(file),
  };
}
