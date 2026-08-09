import { useState } from 'react';
import { 
  Package, Star, Plus, Trash2, ArrowLeft, Save, Tag, Upload, Check, Loader2
} from 'lucide-react';
import ImageUploader, { resolveImageUrl } from '../components/common/ImageUploader';
import type { Product, ProductVariant, ProductImage, ProductStatus, PackagingType } from '../types';
import { adminApi } from '../services/apiClient';

import type { CategoryItem } from './CategoryCMS';

interface ProductEditorProps {
  initialProduct?: Product;
  onBack: () => void;
  onSave: (product: Product) => Promise<void> | void;
  categories?: CategoryItem[];
}

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'cat-1', name: 'Dairy', slug: 'dairy', description: '', iconName: '', displayOrder: 1, isActive: true },
  { id: 'cat-2', name: 'Oils', slug: 'oils', description: '', iconName: '', displayOrder: 2, isActive: true },
  { id: 'cat-3', name: 'Honey', slug: 'honey', description: '', iconName: '', displayOrder: 3, isActive: true },
  { id: 'cat-4', name: 'Spices & Staples', slug: 'spices-staples', description: '', iconName: '', displayOrder: 4, isActive: true },
];

export default function ProductEditor({ initialProduct, onBack, onSave, categories = DEFAULT_CATEGORIES }: ProductEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'core' | 'gallery' | 'variants' | 'nutrition'>('core');

  // Core details state
  const [title, setTitle] = useState(initialProduct?.title || 'Country Dairy A2 Vedic Bilona Ghee');
  const [slug, setSlug] = useState(initialProduct?.slug || 'a2-vedic-bilona-ghee');
  const [tagline, setTagline] = useState(initialProduct?.tagline || '100% Pure Organic Bilona Ghee');
  const [storyDescription, setStoryDescription] = useState(initialProduct?.storyDescription || 'Hand-churned using traditional Bilona method from free-grazing Gir Cow A2 milk.');
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status || 'LIVE');
  const [badgeText, setBadgeText] = useState(initialProduct?.badgeText || '★ Best Seller');
  const [categoryName, setCategoryName] = useState(initialProduct?.categoryName || 'Dairy');

  // Explicit Storefront Details
  const [servingSize, setServingSize] = useState(initialProduct?.specifications?.['Serving Size'] || '100g / 100ml');
  const [shelfLife, setShelfLife] = useState(initialProduct?.specifications?.['Shelf Life'] || '2 days');
  const [storageInstructions, setStorageInstructions] = useState(
    initialProduct?.specifications?.['Storage Instructions'] || 
    'Store in a cool, dry place away from direct sunlight. Keep container tightly sealed after use.'
  );

  // Gallery state (Min 1, Max 10)
  const [galleryImages, setGalleryImages] = useState<ProductImage[]>(initialProduct?.galleryImages || [
    { id: 'img-1', productId: 'p1', imageUrl: 'https://images.unsplash.com/photo-1527153857715-3908f2bae5da?auto=format&fit=crop&w=800&q=80', displayOrder: 1, isPrimary: true },
    { id: 'img-2', productId: 'p1', imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80', displayOrder: 2, isPrimary: false },
  ]);

  // Variant Matrix state
  const [variants, setVariants] = useState<ProductVariant[]>(initialProduct?.variants || [
    {
      id: 'var-1',
      productId: 'p1',
      sku: 'CD-GHEE-500ML',
      sizeLabel: '500 ml Glass Jar',
      sellingPrice: 799,
      mrpPrice: 950,
      stockQuantity: 150,
      lowStockThreshold: 10,
      packagingType: 'GLASS_JAR',
      isActive: true,
      displayOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'var-2',
      productId: 'p1',
      sku: 'CD-GHEE-1L',
      sizeLabel: '1 Litre Glass Jar',
      sellingPrice: 1499,
      mrpPrice: 1800,
      stockQuantity: 45,
      lowStockThreshold: 10,
      packagingType: 'GLASS_JAR',
      isActive: true,
      displayOrder: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'var-3',
      productId: 'p1',
      sku: 'CD-GHEE-2.5L-DOLCHI',
      sizeLabel: '2.5L Traditional Metal Dolchi',
      sellingPrice: 3650,
      mrpPrice: 4200,
      stockQuantity: 0, // Out of stock example
      lowStockThreshold: 5,
      packagingType: 'METAL_DOLCHI',
      isActive: true,
      displayOrder: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Nutrition Facts key-value pairs
  const [nutritionFacts, setNutritionFacts] = useState<Array<{ key: string; value: string }>>([
    { key: 'Energy', value: '897 kcal per 100g' },
    { key: 'Total Fat', value: '99.8g' },
    { key: 'Saturated Fat', value: '65g' },
    { key: 'Vitamin A', value: '300 mcg' },
  ]);

  // Handle adding image to gallery (Max 10 limit)
  const handleAddGalleryImage = (url: string) => {
    if (!url) return;
    if (galleryImages.length >= 10) {
      alert('Maximum 10 product gallery photos allowed.');
      return;
    }

    const newImg: ProductImage = {
      id: `img-${Date.now()}`,
      productId: initialProduct?.id || 'p1',
      imageUrl: url,
      displayOrder: galleryImages.length + 1,
      isPrimary: galleryImages.length === 0,
    };
    setGalleryImages(prev => [...prev, newImg]);
  };

  const handleSetPrimaryImage = (id: string) => {
    setGalleryImages(prev => prev.map(img => ({
      ...img,
      isPrimary: img.id === id,
    })));
  };

  const handleDeleteGalleryImage = (id: string) => {
    if (galleryImages.length <= 1) {
      alert('At least 1 primary thumbnail image must remain in the gallery.');
      return;
    }
    const target = galleryImages.find(i => i.id === id);
    if (target?.imageUrl) {
      adminApi.deleteMedia(target.imageUrl).catch(() => {});
    }
    setGalleryImages(prev => prev.filter(img => img.id !== id));
  };

  const handleAssignVariantToImage = (imageId: string, variantIdOrLabel: string) => {
    // Assign image to variant
    setVariants(prev => prev.map(v => {
      if (v.id === variantIdOrLabel || v.sizeLabel === variantIdOrLabel) {
        const targetImg = galleryImages.find(i => i.id === imageId);
        return { ...v, imageUrl: targetImg?.imageUrl || v.imageUrl };
      }
      return v;
    }));

    setGalleryImages(prev => prev.map(img => {
      if (img.id === imageId) {
        return { ...img, variantId: variantIdOrLabel };
      }
      return img;
    }));
  };

  const handleSetVariantPrimary = (variantIdOrLabel: string, imageUrl: string) => {
    setVariants(prev => prev.map(v => {
      if (v.id === variantIdOrLabel || v.sizeLabel === variantIdOrLabel) {
        return { ...v, imageUrl };
      }
      return v;
    }));
  };

  const handleAddVariant = () => {
    const newVar: ProductVariant = {
      id: `var-${Date.now()}`,
      productId: initialProduct?.id || 'p1',
      sku: `CD-SKU-${Date.now().toString().slice(-4)}`,
      sizeLabel: '1 Litre Pack',
      sellingPrice: 500,
      mrpPrice: 600,
      stockQuantity: 50,
      lowStockThreshold: 10,
      packagingType: 'GLASS_JAR',
      isActive: true,
      displayOrder: variants.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setVariants(prev => [...prev, newVar]);
  };

  const handleDeleteVariant = (id: string) => {
    if (variants.length <= 1) {
      alert('At least 1 product variant must remain.');
      return;
    }
    setVariants(prev => prev.filter(v => v.id !== id));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a product title.');
      return;
    }

    setIsSaving(true);
    try {
      // Convert nutrition array back to object
      const nutritionObj: Record<string, string> = {};
      nutritionFacts.forEach(n => {
        if (n.key.trim()) nutritionObj[n.key.trim()] = n.value.trim();
      });

      const specificationsObj: Record<string, string> = {
        ...(initialProduct?.specifications || {}),
        'Serving Size': servingSize,
        'Shelf Life': shelfLife,
        'Storage Instructions': storageInstructions,
      };

      const updatedProduct: Product = {
        id: initialProduct?.id || `prod-${Date.now()}`,
        title,
        slug,
        tagline,
        storyDescription,
        status,
        badgeText,
        categoryName,
        isFeatured: true,
        displayOrder: 1,
        galleryImages,
        variants,
        specifications: specificationsObj,
        nutritionFacts: nutritionObj,
        createdAt: initialProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(updatedProduct);
    } catch (err: any) {
      alert(`Save failed: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative space-y-6">
      {/* Fullscreen Loading Overlay when Saving Product */}
      {isSaving && (
        <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-stone-900 p-8 rounded-3xl border border-stone-800 shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20">
              <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-stone-100 mb-1">
                Saving Changes to Database...
              </h2>
              <p className="text-xs text-stone-400 leading-relaxed">
                Updating product profile, variant prices, stock levels, and media gallery.
              </p>
            </div>
            <div className="w-full bg-stone-950 rounded-full h-1.5 overflow-hidden border border-stone-800">
              <div className="bg-gradient-to-r from-amber-500 to-amber-300 h-full w-full animate-pulse" />
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900 p-6 rounded-2xl border border-stone-800 text-stone-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors"
            title="Back to Product List"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-5 w-5 text-amber-400" />
              <h1 className="text-xl font-bold">{title || 'Edit Product'}</h1>
            </div>
            <p className="text-xs text-stone-400">Configure title, gallery (1–10 images), variants matrix, and nutrition.</p>
          </div>
        </div>

        <button
          onClick={handleSaveProduct}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <Save className="h-4 w-4" /> Save Product Changes
        </button>
      </div>

      {/* Editor Tabs Navigation */}
      <div className="flex space-x-2 border-b border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('core')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'core'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          1. Core Info & Status
        </button>

        <button
          onClick={() => setActiveTab('gallery')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
            activeTab === 'gallery'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          <span>2. Image Gallery</span>
          <span className="font-mono text-[10px] bg-stone-950/40 px-1.5 py-0.5 rounded">
            {galleryImages.length}/10
          </span>
        </button>

        <button
          onClick={() => setActiveTab('variants')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
            activeTab === 'variants'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          <span>3. Variant Matrix & Stock</span>
          <span className="font-mono text-[10px] bg-stone-950/40 px-1.5 py-0.5 rounded">
            {variants.length} Sizes
          </span>
        </button>

        <button
          onClick={() => setActiveTab('nutrition')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'nutrition'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          4. Nutrition & Specifications
        </button>
      </div>

      {/* TAB 1: CORE DETAILS */}
      {activeTab === 'core' && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4 text-xs text-stone-200">
          <h2 className="text-sm font-bold text-amber-400 border-b border-stone-800 pb-2">Core Product Metadata</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Product Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                }}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Category (Defined in Category CMS)</label>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 font-bold"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Highlight Badge Tag</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
                placeholder="e.g. ★ Best Seller or 14% OFF"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Storefront Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 font-semibold"
              >
                <option value="LIVE">🟢 Live (Visible & Orderable on Storefront)</option>
                <option value="DRAFT">⚪ Draft (Hidden from Storefront)</option>
                <option value="ARCHIVED">⚫ Archived (Hidden, Preserved in Order History)</option>
                <option value="OUT_OF_STOCK">🔴 Out of Stock (Manual Storefront Override)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-semibold mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold mb-1">Farm Origin & Story Description</label>
              <textarea
                rows={4}
                value={storyDescription}
                onChange={(e) => setStoryDescription(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMAGE GALLERY (MIN 1, MAX 10) */}
      {activeTab === 'gallery' && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-amber-400">Product Gallery Manager</h2>
              <p className="text-xs text-stone-400">Upload 1 to 10 photos. Star icon marks Primary Thumbnail. Link photos to specific variants.</p>
            </div>
            <div className="text-xs font-mono font-bold text-amber-400 bg-stone-950 px-3 py-1 rounded-lg border border-stone-700">
              Uploaded: {galleryImages.length} / 10
            </div>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryImages.map((img) => (
              <div key={img.id} className="relative group rounded-xl overflow-hidden border border-stone-700 bg-stone-950 flex flex-col justify-between">
                <div className="relative aspect-square bg-stone-900">
                  <img src={resolveImageUrl(img.imageUrl)} alt="Gallery item" className="w-full h-full object-cover" />
                  
                  {/* Badges Container */}
                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
                    {/* Main Product Catalog Cover Badge */}
                    {img.isPrimary ? (
                      <div className="bg-amber-500 text-stone-950 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                        <Star className="h-3 w-3 fill-stone-950" />
                        <span>MAIN CATALOG COVER</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImage(img.id)}
                        className="bg-stone-900/80 hover:bg-amber-500 hover:text-stone-950 text-stone-300 text-[9px] font-bold px-2 py-0.5 rounded-md transition-colors backdrop-blur-sm border border-stone-700"
                      >
                        Set Main Cover
                      </button>
                    )}

                    {/* Variant Cover Badge or Set Primary for Variant Button */}
                    {img.variantId && (() => {
                      const linkedVariant = variants.find(v => v.id === img.variantId || v.sizeLabel === img.variantId);
                      const isVarPrimary = linkedVariant && (linkedVariant.imageUrl === img.imageUrl || !linkedVariant.imageUrl);

                      if (isVarPrimary) {
                        return (
                          <div className="bg-emerald-500 text-stone-950 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md truncate max-w-full">
                            <Check className="h-3 w-3 stroke-[3]" />
                            <span className="truncate">Primary for {linkedVariant?.sizeLabel || img.variantId}</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => handleSetVariantPrimary(img.variantId!, img.imageUrl)}
                          className="bg-stone-900/90 text-emerald-400 hover:bg-emerald-500 hover:text-stone-950 text-[9px] font-bold px-2 py-0.5 rounded-md transition-colors backdrop-blur-sm border border-emerald-600/60 truncate max-w-full"
                          title={`Make this the primary photo for ${linkedVariant?.sizeLabel || img.variantId}`}
                        >
                          Set Primary for {linkedVariant?.sizeLabel || img.variantId}
                        </button>
                      );
                    })()}
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteGalleryImage(img.id)}
                    className="absolute top-1.5 right-1.5 p-1.5 bg-stone-950/80 hover:bg-red-600 text-stone-300 hover:text-white rounded-lg transition-colors border border-stone-700 cursor-pointer"
                    title="Remove Image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Variant Selector */}
                <div className="p-2 bg-stone-950 border-t border-stone-800 space-y-1">
                  <label className="text-[9px] font-semibold text-stone-400 flex items-center gap-1">
                    <Tag className="h-3 w-3 text-amber-400" />
                    <span>Variant Link:</span>
                  </label>
                  <select
                    value={img.variantId || ''}
                    onChange={(e) => handleAssignVariantToImage(img.id, e.target.value)}
                    className="w-full text-[10px] bg-stone-900 border border-stone-800 rounded px-2 py-1 text-stone-200 focus:border-amber-400"
                  >
                    <option value="">🌐 Shared (All Variants)</option>
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>
                        🏷️ {v.sizeLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Uploader for Adding Image */}
          {galleryImages.length < 10 && (
            <div className="pt-4 border-t border-stone-800">
              <ImageUploader
                bucket="products"
                label={`Upload Gallery Photo #${galleryImages.length + 1} (Auto WebP Compressed)`}
                aspectRatio="square"
                clearOnUpload={true}
                onImageUploaded={handleAddGalleryImage}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VARIANT MATRIX & STOCK */}
      {activeTab === 'variants' && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-amber-400">Universal Variant Matrix & Stock</h2>
              <p className="text-xs text-stone-400">Manage size options, prices, stock levels, variant images, and packaging types.</p>
            </div>
            <button
              type="button"
              onClick={handleAddVariant}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-lg transition-all"
            >
              <Plus className="h-4 w-4" /> Add Size Variant
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950 text-stone-400 font-semibold border-b border-stone-800 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Variant Image</th>
                  <th className="p-3">Size / Option</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Selling Price (₹)</th>
                  <th className="p-3">MRP (₹)</th>
                  <th className="p-3">Stock Qty</th>
                  <th className="p-3">Packaging Type</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {variants.map((v, idx) => (
                  <tr key={v.id} className={v.stockQuantity === 0 ? 'bg-red-500/10' : ''}>
                    <td className="p-3">
                      {v.imageUrl ? (
                        <div className="flex items-center gap-1.5">
                          <img src={resolveImageUrl(v.imageUrl)} alt="" className="w-8 h-8 rounded object-cover border border-stone-700" />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...variants];
                              updated[idx].imageUrl = '';
                              setVariants(updated);
                            }}
                            className="text-stone-400 hover:text-red-400 p-0.5"
                            title="Remove image"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-[170px]">
                          <select
                            value={v.imageUrl || ''}
                            onChange={(e) => {
                              const updated = [...variants];
                              updated[idx].imageUrl = e.target.value;
                              setVariants(updated);
                            }}
                            className="px-2 py-1 bg-stone-950 border border-stone-800 rounded text-[10px] text-stone-200"
                          >
                            <option value="">
                              {galleryImages.length > 0 ? '-- Select Gallery Photo --' : '-- No Gallery Photos --'}
                            </option>
                            {galleryImages.map(img => (
                              <option key={img.id} value={img.imageUrl}>
                                Photo #{img.displayOrder} {img.isPrimary ? '(Primary)' : ''}
                              </option>
                            ))}
                          </select>

                          <label className="p-1 bg-stone-800 hover:bg-[#C59B27] text-stone-300 hover:text-stone-950 rounded border border-stone-700 cursor-pointer transition-colors shrink-0" title="Upload variant photo">
                            <Upload className="h-3 w-3" />
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const webpFilename = file.name.replace(/\.[^/.]+$/, '') + '.webp';
                                  const url = await adminApi.uploadMedia(file, webpFilename, 'products');
                                  
                                  const updated = [...variants];
                                  updated[idx].imageUrl = url;
                                  setVariants(updated);

                                  setGalleryImages(prev => [
                                    ...prev,
                                    {
                                      id: `img-${Date.now()}`,
                                      productId: initialProduct?.id || 'p1',
                                      imageUrl: url,
                                      variantId: v.id,
                                      displayOrder: prev.length + 1,
                                      isPrimary: prev.length === 0,
                                    }
                                  ]);
                                } catch (err: any) {
                                  alert(`Upload failed: ${err?.message || err}`);
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <input
                        type="text"
                        value={v.sizeLabel}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[idx].sizeLabel = e.target.value;
                          setVariants(updated);
                        }}
                        className="px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded text-stone-100 font-bold w-full"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[idx].sku = e.target.value;
                          setVariants(updated);
                        }}
                        className="px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded text-stone-100 font-mono w-full"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        value={v.sellingPrice}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[idx].sellingPrice = parseFloat(e.target.value) || 0;
                          setVariants(updated);
                        }}
                        className="px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded text-amber-400 font-bold w-24"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        value={v.mrpPrice}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[idx].mrpPrice = parseFloat(e.target.value) || 0;
                          setVariants(updated);
                        }}
                        className="px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded text-stone-400 line-through w-24"
                      />
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={v.stockQuantity}
                          onChange={(e) => {
                            const updated = [...variants];
                            updated[idx].stockQuantity = parseInt(e.target.value) || 0;
                            setVariants(updated);
                          }}
                          className={`px-2.5 py-1.5 border rounded font-bold w-20 ${
                            v.stockQuantity === 0 
                              ? 'bg-red-500/20 text-red-400 border-red-500/50'
                              : 'bg-stone-950 text-stone-100 border-stone-700'
                          }`}
                        />
                        {v.stockQuantity === 0 && (
                          <span className="text-[10px] font-bold bg-red-500 text-stone-950 px-1.5 py-0.5 rounded">
                            OUT OF STOCK
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <select
                        value={v.packagingType}
                        onChange={(e) => {
                          const updated = [...variants];
                          updated[idx].packagingType = e.target.value as PackagingType;
                          setVariants(updated);
                        }}
                        className="px-2 py-1.5 bg-stone-950 border border-stone-700 rounded text-stone-200 text-xs"
                      >
                        <option value="GLASS_JAR">Glass Jar</option>
                        <option value="METAL_DOLCHI">Traditional Metal Dolchi</option>
                        <option value="FOOD_GRADE_TIN">Food Grade Tin</option>
                        <option value="PET_BOTTLE">PET Bottle</option>
                        <option value="ECO_POUCH">Eco Pouch</option>
                      </select>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(v.id)}
                        className="p-1.5 text-stone-400 hover:text-red-400 transition-colors"
                        title="Delete Variant"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: NUTRITION & SPECIFICATIONS */}
      {activeTab === 'nutrition' && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-6 text-xs text-stone-200">
          {/* Explicit Storefront Product Details Fields */}
          <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-stone-800 pb-2">
              Storefront Product Details Page Fields
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Standard Serving Size</label>
                <input
                  type="text"
                  value={servingSize}
                  onChange={(e) => setServingSize(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-medium"
                  placeholder="e.g. 100g / 100ml"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Shelf Life</label>
                <input
                  type="text"
                  value={shelfLife}
                  onChange={(e) => setShelfLife(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-medium"
                  placeholder="e.g. 2 days or 12 Months"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Storage Instructions</label>
              <textarea
                rows={2}
                value={storageInstructions}
                onChange={(e) => setStorageInstructions(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-medium"
                placeholder="e.g. Store in a cool, dry place away from direct sunlight. Keep container tightly sealed after use."
              />
            </div>
          </div>

          {/* Dynamic Nutrition Facts */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-amber-400">Nutrition Facts & Metrics Breakdown</h2>
              <p className="text-xs text-stone-400">Dynamic Key-Value nutritional details displayed on storefront.</p>
            </div>
            <button
              type="button"
              onClick={() => setNutritionFacts(prev => [...prev, { key: '', value: '' }])}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-lg border border-stone-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Metric
            </button>
          </div>

          <div className="space-y-2">
            {nutritionFacts.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Metric (e.g. Fat, Energy)"
                  value={item.key}
                  onChange={(e) => {
                    const updated = [...nutritionFacts];
                    updated[idx].key = e.target.value;
                    setNutritionFacts(updated);
                  }}
                  className="w-1/3 px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-stone-100 font-semibold"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. 99.8g per 100g)"
                  value={item.value}
                  onChange={(e) => {
                    const updated = [...nutritionFacts];
                    updated[idx].value = e.target.value;
                    setNutritionFacts(updated);
                  }}
                  className="flex-1 px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-stone-100"
                />
                <button
                  type="button"
                  onClick={() => setNutritionFacts(prev => prev.filter((_, i) => i !== idx))}
                  className="p-2 text-stone-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
