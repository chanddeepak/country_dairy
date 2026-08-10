/**
 * What the media endpoints accept.
 *
 * Kept in one place because the limits apply in three: the presigned-url
 * handler, the multipart fallback, and the admin console's client-side guard.
 */

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov, what an iPhone records
] as const;

/** Lab reports arrive as the lab's signed PDF. Nothing else is accepted. */
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

export const ALL_MEDIA_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
];

/**
 * Images are compressed to WebP in the browser before upload, so they arrive
 * small. Video is not, hence the much larger ceiling — a 30-second product
 * clip off a phone is comfortably over 20MB.
 */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export type MediaKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export function mediaKindFor(mimeType: string): MediaKind | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'IMAGE';
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return 'VIDEO';
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) return 'DOCUMENT';
  return null;
}

export function maxBytesFor(kind: MediaKind): number {
  if (kind === 'VIDEO') return MAX_VIDEO_BYTES;
  if (kind === 'DOCUMENT') return MAX_DOCUMENT_BYTES;
  return MAX_IMAGE_BYTES;
}

export function humanSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/** Extension to use when the upload has none, so Storage serves a sane type. */
export function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
  };
  return map[mimeType] ?? '.bin';
}
