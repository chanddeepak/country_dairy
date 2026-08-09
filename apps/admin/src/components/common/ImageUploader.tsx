import { useState, useEffect, useRef } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { adminApi } from '../../services/apiClient';

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  maxSizeBytes?: number; // Defaults to 5MB (5 * 1024 * 1024)
  aspectRatio?: 'desktop' | 'mobile' | 'square';
  label?: string;
  currentImageUrl?: string;
  bucket?: 'hero-banners' | 'products';
}

export function resolveImageUrl(url?: string | null): string {
  if (!url || url.startsWith('blob:')) return '';
  if (url.startsWith('/hero-banners/') || url.startsWith('/products/')) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ieugxahinfowtlryyzmv.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public${url}`;
  }
  if (url.startsWith('/storage/v1/object/public/')) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ieugxahinfowtlryyzmv.supabase.co';
    return `${supabaseUrl}${url}`;
  }
  if (url.startsWith('/uploads/')) {
    const apiHost = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
    return `${apiHost}${url}`;
  }
  return url;
}

export default function ImageUploader({
  onImageUploaded,
  maxSizeBytes = 100 * 1024 * 1024, // 100MB (unrestricted limit)
  aspectRatio: _aspectRatio = 'square',
  label = 'Upload Photo',
  currentImageUrl: _currentImageUrl,
  bucket = 'products',
}: ImageUploaderProps) {
  // Sync previewUrl when currentImageUrl prop updates or resets (e.g. switching slides or after save)
  const [previewUrl, setPreviewUrl] = useState<string | null>(_currentImageUrl || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [_originalSizeKB, setOriginalSizeKB] = useState<number | null>(null);
  const [_compressedSizeKB, setCompressedSizeKB] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(_currentImageUrl || null);
  }, [_currentImageUrl]);

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

    // 1. File Size Guard (if maxSizeBytes set)
    if (maxSizeBytes && file.size > maxSizeBytes) {
      const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds ${maxMB}MB limit.`);
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
      const relativeUrl = await adminApi.uploadMedia(blob, webpFilename, bucket);

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
        <span className="text-[10px] text-stone-400">WebP Auto-Compressed</span>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {/* Upload Drop Zone (Always displayed cleanly as the uploader control) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-amber-400 bg-amber-500/10'
            : previewUrl
            ? 'border-emerald-500/40 bg-emerald-950/20 hover:bg-stone-800/50 hover:border-emerald-500/60'
            : 'border-stone-700 bg-stone-900/50 hover:bg-stone-800/50 hover:border-stone-600'
        }`}
      >
        {isCompressing ? (
          <div className="space-y-1.5 py-1">
            <div className="animate-spin text-amber-400 text-xl mx-auto">⏳</div>
            <div className="text-xs text-stone-300 font-semibold">Auto-compressing to WebP...</div>
          </div>
        ) : previewUrl ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-stone-200 flex items-center gap-2">
                  <span>Image Uploaded</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                    WebP Active
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 truncate max-w-xs sm:max-w-md">
                  Click or drag new image to replace
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-stone-800 hover:bg-[#C59B27] text-stone-200 hover:text-stone-950 font-bold text-xs rounded-lg transition-colors border border-stone-700 flex items-center gap-1.5 cursor-pointer"
                title="Upload new image"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 bg-stone-800 hover:bg-red-500/20 text-stone-400 hover:text-red-400 rounded-lg transition-colors border border-stone-700 cursor-pointer"
                title="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="w-8 h-8 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center border border-stone-700 shrink-0">
              <Upload className="h-4 w-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-stone-200">
                Click or drag image here
              </div>
              <div className="text-[10px] text-stone-400">
                JPG, PNG, or WebP up to 5MB (Auto-WebP)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
