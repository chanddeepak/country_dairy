import { Star, Trash2, Play } from 'lucide-react';
import ImageUploader, { resolveImageUrl } from '../common/ImageUploader';
import { MAX_GALLERY_ITEMS, type ProductFormState } from '../../hooks/useProductForm';

export default function GalleryTab({ form }: { form: ProductFormState }) {
  const { gallery, variantMatrix } = form;

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#064e3b] uppercase tracking-wider">
            Product Gallery
          </h2>
          <p className="text-xs text-[#6b6661] mt-0.5">
            Photos and video. The starred still is the catalogue cover.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-[#6b6661]">
          {gallery.items.length}/{MAX_GALLERY_ITEMS}
        </span>
      </div>

      {gallery.items.length < MAX_GALLERY_ITEMS && (
        <ImageUploader
          bucket="products"
          allowVideo
          clearOnUpload
          aspectRatio="square"
          label={`Upload item ${gallery.items.length + 1}`}
          onImageUploaded={(url, mediaType) => gallery.add(url, mediaType ?? 'IMAGE')}
        />
      )}

      {gallery.items.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6b6661] font-medium border border-dashed border-stone-300 rounded-xl">
          No media yet. Add at least one photo so the product has a cover.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {gallery.items.map((img) => {
            const isVideo = img.mediaType === 'VIDEO';

            return (
              <div
                key={img.id}
                className="relative rounded-xl overflow-hidden border border-stone-200 bg-[#FAF8F3] flex flex-col"
              >
                <div className="relative aspect-square">
                  {isVideo ? (
                    <video
                      src={resolveImageUrl(img.imageUrl)}
                      className="w-full h-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={resolveImageUrl(img.imageUrl)}
                      alt={img.altText ?? 'Gallery item'}
                      className="w-full h-full object-cover"
                    />
                  )}

                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start pointer-events-none">
                    {isVideo && (
                      <span className="bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                        Video
                      </span>
                    )}
                    {img.isPrimary && (
                      <span className="bg-[#C59B27] text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                    {img.isVariantPrimary && (
                      <span className="bg-[#064e3b] text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                        Variant cover
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 space-y-2 bg-white border-t border-stone-100">
                  <select
                    value={img.variantId ?? ''}
                    onChange={(e) => gallery.assignToVariant(img.id, e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#FAF8F3] border border-stone-200 rounded-lg text-[11px] font-medium focus:outline-none focus:border-[#064e3b]"
                  >
                    <option value="">Shared across variants</option>
                    {variantMatrix.items.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sizeLabel || 'Unnamed variant'}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5">
                    {/* Only a still can be a cover — a card cannot render a video. */}
                    {!isVideo && (
                      <button
                        type="button"
                        onClick={() => gallery.setPrimary(img.id)}
                        disabled={img.isPrimary}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-stone-200 text-[#6b6661] hover:text-[#C59B27] hover:border-[#C59B27] disabled:opacity-40 transition-colors"
                        title="Use as catalogue cover"
                      >
                        <Star className="h-3 w-3" /> Cover
                      </button>
                    )}

                    {img.variantId && !isVideo && (
                      <button
                        type="button"
                        onClick={() => gallery.setVariantPrimary(img.variantId!, img.imageUrl)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-stone-200 text-[#6b6661] hover:text-[#064e3b] hover:border-[#064e3b] transition-colors"
                        title="Use as this variant's image"
                      >
                        <Play className="h-3 w-3" /> Variant
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => gallery.remove(img.id)}
                      className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-300 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
