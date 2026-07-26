import { useState, useRef, useEffect } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { adminApi } from '../../services/apiClient';

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  maxSizeBytes?: number; // Defaults to 5MB (5 * 1024 * 1024)
  aspectRatio?: 'desktop' | 'mobile' | 'square';
  label?: string;
  currentImageUrl?: string;
}

export function resolveImageUrl(url?: string | null): string {
  if (!url || url.startsWith('blob:')) return '';
  if (url.startsWith('/uploads/')) {
    const apiHost = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
    return `${apiHost}${url}`;
  }
  return url;
}

export default function ImageUploader({
  onImageUploaded,
  maxSizeBytes = 5 * 1024 * 1024, // 5MB
  aspectRatio = 'square',
  label = 'Upload Photo',
  currentImageUrl
}: ImageUploaderProps) {
  const initialUrl = (currentImageUrl && !currentImageUrl.startsWith('blob:')) ? currentImageUrl : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [isCompressing, setIsCompressing] = useState(false);
  const [originalSizeKB, setOriginalSizeKB] = useState<number | null>(null);
  const [compressedSizeKB, setCompressedSizeKB] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentImageUrl && !currentImageUrl.startsWith('blob:')) {
      setPreviewUrl(currentImageUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [currentImageUrl]);

  // Compress image on client side using HTML5 Canvas API (JPG/PNG -> WebP @ 85% quality)
  const compressToWebPBlob = (file: File): Promise<{ blob: Blob; sizeKB: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max resolution 1920px for optimal speed/quality ratio
          const maxDim = 1920;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP format at 85% quality
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }
              const sizeKB = Math.round(blob.size / 1024);
              resolve({ blob, sizeKB });
            },
            'image/webp',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File) => {
    setError(null);

    // 1. Strict 5MB File Size Guard
    if (file.size > maxSizeBytes) {
      const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds ${maxMB}MB limit. Please select a smaller photo.`);
      return;
    }

    // 2. Format validation
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setOriginalSizeKB(Math.round(file.size / 1024));
    setIsCompressing(true);

    try {
      // 3. Client-side WebP Compression
      const { blob, sizeKB } = await compressToWebPBlob(file);
      setCompressedSizeKB(sizeKB);

      // 4. Upload file to backend server & store relative path
      const webpFilename = file.name.replace(/\.[^/.]+$/, '') + '.webp';
      const relativeUrl = await adminApi.uploadMedia(blob, webpFilename);

      setPreviewUrl(relativeUrl);
      onImageUploaded(relativeUrl);
    } catch (err: any) {
      setError(err.message || 'Image processing failed');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setOriginalSizeKB(null);
    setCompressedSizeKB(null);
    setError(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-stone-300">{label}</label>
        <span className="text-[10px] text-stone-400">Max 5MB • WebP Auto-Compressed</span>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Box or Image Preview */}
      {previewUrl ? (
        <div className="relative group rounded-xl overflow-hidden border border-stone-700 bg-stone-900">
          <img
            src={resolveImageUrl(previewUrl)}
            alt="Uploaded preview"
            onError={() => setPreviewUrl(null)}
            className={`w-full object-cover ${
              aspectRatio === 'desktop' ? 'h-36' : aspectRatio === 'mobile' ? 'h-48' : 'h-32'
            }`}
          />

          {/* Remove Overlay Button */}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-stone-950/80 text-stone-300 hover:text-red-400 rounded-full transition-colors backdrop-blur-sm"
            title="Remove image"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Compression Badge */}
          {originalSizeKB !== null && compressedSizeKB !== null && (
            <div className="absolute bottom-2 left-2 bg-stone-950/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <Check className="h-3 w-3" />
              <span>
                {originalSizeKB}KB → <strong className="text-stone-100">{compressedSizeKB}KB</strong> ({Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100)}% saved)
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-stone-700 bg-stone-900/50 hover:bg-stone-800/50 hover:border-stone-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {isCompressing ? (
            <div className="space-y-2 py-2">
              <div className="animate-spin text-amber-400 text-2xl mx-auto">⏳</div>
              <div className="text-xs text-stone-300 font-semibold">Auto-compressing to WebP...</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center mx-auto border border-stone-700">
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold text-stone-200">
                Click or drag image here
              </div>
              <div className="text-[10px] text-stone-400">
                JPG, PNG, or WebP up to 5MB
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
