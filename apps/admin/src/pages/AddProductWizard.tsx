import { useState } from 'react';
import { Plus, Trash2, ArrowRight, Check } from 'lucide-react';
import ImageUploader from '../components/common/ImageUploader';
import type { Product, ProductStatus, PackagingType, ProductImage } from '../types';
import type { CategoryItem } from './CategoryCMS';

interface AddProductWizardProps {
  onCancel: () => void;
  onComplete: (product: Product) => void;
  categories?: CategoryItem[];
}

const VARIANT_PRESETS = [
  {
    name: 'Ghee Sizes (500ml, 1L, 2.5L, 5L)',
    variants: [
      { sizeLabel: '500 ml Glass Jar', sellingPrice: 799, mrpPrice: 950, stockQuantity: 100, packagingType: 'GLASS_JAR' as PackagingType },
      { sizeLabel: '1 Litre Glass Jar', sellingPrice: 1499, mrpPrice: 1800, stockQuantity: 100, packagingType: 'GLASS_JAR' as PackagingType },
      { sizeLabel: '2.5L Metal Dolchi', sellingPrice: 3650, mrpPrice: 4200, stockQuantity: 50, packagingType: 'METAL_DOLCHI' as PackagingType },
      { sizeLabel: '5L Traditional Metal Dolchi', sellingPrice: 6999, mrpPrice: 8000, stockQuantity: 25, packagingType: 'METAL_DOLCHI' as PackagingType },
    ]
  },
  {
    name: 'Milk Sizes (500ml, 1L, 2L, 5L)',
    variants: [
      { sizeLabel: '500 ml Pouch', sellingPrice: 48, mrpPrice: 50, stockQuantity: 500, packagingType: 'ECO_POUCH' as PackagingType },
      { sizeLabel: '1 Litre Glass Bottle', sellingPrice: 95, mrpPrice: 100, stockQuantity: 300, packagingType: 'GLASS_JAR' as PackagingType },
      { sizeLabel: '2 Litre Family Pack', sellingPrice: 185, mrpPrice: 195, stockQuantity: 200, packagingType: 'PET_BOTTLE' as PackagingType },
    ]
  }
];

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'cat-1', name: 'Dairy', slug: 'dairy', description: '', iconName: '', displayOrder: 1, isActive: true },
  { id: 'cat-2', name: 'Oils', slug: 'oils', description: '', iconName: '', displayOrder: 2, isActive: true },
  { id: 'cat-3', name: 'Honey', slug: 'honey', description: '', iconName: '', displayOrder: 3, isActive: true },
  { id: 'cat-4', name: 'Spices & Staples', slug: 'spices-staples', description: '', iconName: '', displayOrder: 4, isActive: true },
];

export default function AddProductWizard({ onCancel, onComplete, categories = DEFAULT_CATEGORIES }: AddProductWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Core Details
  const [title, setTitle] = useState('');
  const [categoryName, setCategoryName] = useState(categories[0]?.name || 'Dairy');
  const [tagline, setTagline] = useState('');
  const [storyDescription, setStoryDescription] = useState('');

  // Step 2: Variants Matrix
  const [variants, setVariants] = useState<Array<{ sizeLabel: string; sellingPrice: number; mrpPrice: number; stockQuantity: number; packagingType: PackagingType }>>([
    { sizeLabel: '1 Litre Pack', sellingPrice: 500, mrpPrice: 600, stockQuantity: 50, packagingType: 'GLASS_JAR' }
  ]);

  // Step 3: Gallery (1-10)
  const [galleryImages, setGalleryImages] = useState<ProductImage[]>([]);

  // Step 4: Visibility, Specifications & Nutrition
  const [status, setStatus] = useState<ProductStatus>('LIVE');
  const [badgeText, setBadgeText] = useState('★ FRESH ARRIVAL');
  const [isFeatured, setIsFeatured] = useState(true);
  const [isSubscriptionAllowed, setIsSubscriptionAllowed] = useState(false); // Default OFF

  // Explicit Storefront Details
  const [servingSize, setServingSize] = useState('100g / 100ml');
  const [shelfLife, setShelfLife] = useState('2 days');
  const [storageInstructions, setStorageInstructions] = useState('Store in a cool, dry place away from direct sunlight. Keep container tightly sealed after use.');

  // Dynamic Specs & Nutrition
  const [specRows, setSpecRows] = useState<Array<{ key: string; value: string }>>([
    { key: 'Origin', value: 'Country Dairy Organic Farm' },
    { key: 'Processing Method', value: 'Traditional Cold Pressed / Bilona' }
  ]);
  const [nutritionRows, setNutritionRows] = useState<Array<{ key: string; value: string }>>([
    { key: 'Energy', value: '120 kcal per 100g' },
    { key: 'Protein', value: '4.5g per 100g' }
  ]);

  const applyPreset = (presetIndex: number) => {
    const selected = VARIANT_PRESETS[presetIndex];
    setVariants(selected.variants);
  };

  const handleAddImage = (url: string) => {
    if (!url) return;
    if (galleryImages.length >= 10) {
      alert('Maximum 10 images allowed per product gallery.');
      return;
    }
    const newImg: ProductImage = {
      id: `img-${Date.now()}-${galleryImages.length}`,
      productId: 'temp',
      imageUrl: url,
      displayOrder: galleryImages.length + 1,
      isPrimary: galleryImages.length === 0,
    };
    setGalleryImages([...galleryImages, newImg]);
  };

  const handleFinish = () => {
    if (!title.trim()) {
      alert('Product title is required.');
      setCurrentStep(1);
      return;
    }

    if (galleryImages.length === 0) {
      alert('Please upload at least 1 image to the gallery.');
      setCurrentStep(3);
      return;
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Convert spec & nutrition arrays to key-value objects
    const specificationsObj: Record<string, string> = {
      'Serving Size': servingSize,
      'Shelf Life': shelfLife,
      'Storage Instructions': storageInstructions,
    };
    specRows.forEach(r => { if (r.key.trim()) specificationsObj[r.key.trim()] = r.value.trim(); });

    const nutritionFactsObj: Record<string, string> = {};
    nutritionRows.forEach(r => { if (r.key.trim()) nutritionFactsObj[r.key.trim()] = r.value.trim(); });

    const finalProduct: Product = {
      id: `prod-${Date.now()}`,
      title,
      slug,
      tagline,
      storyDescription,
      status,
      categoryName,
      badgeText,
      isFeatured,
      displayOrder: 1,
      isSubscriptionAllowed, // Default OFF
      galleryImages,
      specifications: specificationsObj,
      nutritionFacts: nutritionFactsObj,
      variants: variants.map((v, idx) => ({
        id: `var-${Date.now()}-${idx}`,
        productId: `prod-${Date.now()}`,
        sku: `CD-${slug.toUpperCase()}-${idx + 1}`,
        sizeLabel: v.sizeLabel,
        sellingPrice: v.sellingPrice,
        mrpPrice: v.mrpPrice,
        stockQuantity: v.stockQuantity,
        lowStockThreshold: 10,
        packagingType: v.packagingType,
        isActive: true,
        displayOrder: idx + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onComplete(finalProduct);
  };

  return (
    <div className="bg-stone-900 p-6 sm:p-8 rounded-2xl border border-stone-800 space-y-6 text-stone-100 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-stone-100">4-Step Add New Product Wizard</h1>
          <p className="text-xs text-stone-400">Step {currentStep} of 4: Guided product creation flow</p>
        </div>
        <button onClick={onCancel} className="text-xs font-semibold text-stone-400 hover:text-stone-200">
          Cancel & Close
        </button>
      </div>

      {/* Progress Stepper Bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { step: 1, title: '1. Core Details' },
          { step: 2, title: '2. Variants & Stock' },
          { step: 3, title: '3. Image Gallery' },
          { step: 4, title: '4. Specs & Publish' },
        ].map((item) => (
          <div
            key={item.step}
            onClick={() => setCurrentStep(item.step as any)}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
              currentStep === item.step
                ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-md'
                : currentStep > item.step
                ? 'bg-stone-800 text-amber-400 border-stone-700'
                : 'bg-stone-900 text-stone-500 border-stone-800'
            }`}
          >
            <div className="text-xs">{item.title}</div>
          </div>
        ))}
      </div>

      {/* STEP 1: CORE INFO */}
      {currentStep === 1 && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4 text-xs text-stone-200">
          <h2 className="text-sm font-bold text-amber-400 border-b border-stone-800 pb-2">Step 1: Core Details</h2>
          
          <div>
            <label className="block font-semibold mb-1">Product Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
              placeholder="e.g. Country Dairy Organic Wild Honey"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Category (Defined in Category CMS) *</label>
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
            <label className="block font-semibold mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
              placeholder="e.g. 100% Unprocessed Raw Forest Honey"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Farm Origin & Product Story</label>
            <textarea
              rows={3}
              value={storyDescription}
              onChange={(e) => setStoryDescription(e.target.value)}
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
              placeholder="Describe the traditional farming process, purity, and sourcing..."
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                if (!title.trim()) { alert('Please enter Product Title'); return; }
                setCurrentStep(2);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-xs"
            >
              <span>Next: Variants & Stock</span> <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: VARIANTS MATRIX */}
      {currentStep === 2 && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4 text-xs text-stone-200">
          <div className="flex justify-between items-center border-b border-stone-800 pb-2">
            <h2 className="text-sm font-bold text-amber-400">Step 2: Variant Matrix & Stock Quantities</h2>
            <div className="flex gap-2">
              {VARIANT_PRESETS.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => applyPreset(pIdx)}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 rounded text-[10px] font-semibold"
                >
                  ⚡ Preset: {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {variants.map((variant, idx) => (
              <div key={idx} className="p-3 bg-stone-950 rounded-xl border border-stone-800 grid grid-cols-5 gap-2 items-center">
                <div className="col-span-2">
                  <label className="block text-[10px] text-stone-400 mb-0.5">Size / Variant Label</label>
                  <input
                    type="text"
                    value={variant.sizeLabel}
                    onChange={(e) => {
                      const updated = [...variants];
                      updated[idx].sizeLabel = e.target.value;
                      setVariants(updated);
                    }}
                    className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded font-semibold text-stone-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-stone-400 mb-0.5">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={variant.sellingPrice}
                    onChange={(e) => {
                      const updated = [...variants];
                      updated[idx].sellingPrice = Number(e.target.value);
                      setVariants(updated);
                    }}
                    className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded font-mono text-stone-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-stone-400 mb-0.5">Stock Units</label>
                  <input
                    type="number"
                    value={variant.stockQuantity}
                    onChange={(e) => {
                      const updated = [...variants];
                      updated[idx].stockQuantity = Number(e.target.value);
                      setVariants(updated);
                    }}
                    className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded font-mono text-amber-400 font-bold"
                  />
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (variants.length <= 1) { alert('Minimum 1 variant required'); return; }
                      setVariants(variants.filter((_, i) => i !== idx));
                    }}
                    className="p-1.5 text-stone-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setVariants([...variants, { sizeLabel: 'New Pack Size', sellingPrice: 500, mrpPrice: 600, stockQuantity: 50, packagingType: 'GLASS_JAR' }])}
            className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Size Variant
          </button>

          <div className="flex justify-between pt-4">
            <button onClick={() => setCurrentStep(1)} className="px-4 py-2 bg-stone-800 rounded-xl">Back</button>
            <button onClick={() => setCurrentStep(3)} className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 text-stone-950 font-bold rounded-xl">
              <span>Next: Image Gallery</span> <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: GALLERY */}
      {currentStep === 3 && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4 text-xs text-stone-200">
          <div className="flex justify-between items-center border-b border-stone-800 pb-2">
            <h2 className="text-sm font-bold text-amber-400">Step 3: Product Image Gallery (1-10 Photos)</h2>
            <span className="font-mono text-xs text-stone-400">{galleryImages.length}/10 Images Uploaded</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {galleryImages.map((img, idx) => (
              <div key={img.id} className="relative aspect-square bg-stone-950 border border-stone-800 rounded-xl overflow-hidden group">
                <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setGalleryImages(galleryImages.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <ImageUploader
            label="Upload Product Photo (Auto WebP Compressed)"
            aspectRatio="square"
            onImageUploaded={handleAddImage}
          />

          <div className="flex justify-between pt-4">
            <button onClick={() => setCurrentStep(2)} className="px-4 py-2 bg-stone-800 rounded-xl">Back</button>
            <button onClick={() => {
              if (galleryImages.length === 0) { alert('Upload at least 1 image to the gallery.'); return; }
              setCurrentStep(4);
            }} className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 text-stone-950 font-bold rounded-xl">
              <span>Next: Specs & Publish</span> <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SPECS, NUTRITION & PUBLISH */}
      {currentStep === 4 && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-6 text-xs text-stone-200">
          <h2 className="text-sm font-bold text-amber-400 border-b border-stone-800 pb-2">
            Step 4: Specifications, Nutrition Facts & Storefront Publish
          </h2>

          {/* Badge & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 font-semibold"
              >
                <option value="LIVE">🟢 Live (Visible & Orderable immediately)</option>
                <option value="DRAFT">⚪ Draft (Saved for later review)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Highlight Badge Tag</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
                placeholder="e.g. ★ BEST SELLER"
              />
            </div>
          </div>

          {/* Checkbox Toggles */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-stone-950 rounded-xl border border-stone-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="accent-amber-500"
              />
              <span className="font-semibold text-stone-200">Featured Product on Homepage</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSubscriptionAllowed}
                onChange={(e) => setIsSubscriptionAllowed(e.target.checked)}
                className="accent-amber-500"
              />
              <span className="font-semibold text-stone-200">Allow Customer Subscriptions (Default: OFF)</span>
            </label>
          </div>
          {/* EXPLICIT STOREFRONT DETAILS FIELDS */}
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

          {/* DYNAMIC SPECIFICATIONS TABLE EDITOR */}
          <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Product Technical Specifications</span>
              <button
                type="button"
                onClick={() => setSpecRows([...specRows, { key: '', value: '' }])}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[10px] font-bold"
              >
                + Add Specification Row
              </button>
            </div>

            {specRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Spec Key (e.g., Milk Type)"
                  value={row.key}
                  onChange={(e) => {
                    const updated = [...specRows];
                    updated[idx].key = e.target.value;
                    setSpecRows(updated);
                  }}
                  className="w-1/3 px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded text-stone-100 font-semibold"
                />
                <input
                  type="text"
                  placeholder="Spec Value (e.g., A2 Beta-Casein Protein)"
                  value={row.value}
                  onChange={(e) => {
                    const updated = [...specRows];
                    updated[idx].value = e.target.value;
                    setSpecRows(updated);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded text-stone-200"
                />
                <button
                  type="button"
                  onClick={() => setSpecRows(specRows.filter((_, i) => i !== idx))}
                  className="p-1.5 text-stone-500 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* DYNAMIC NUTRITION FACTS TABLE EDITOR */}
          <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Nutrition Facts Breakdown</span>
              <button
                type="button"
                onClick={() => setNutritionRows([...nutritionRows, { key: '', value: '' }])}
                className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[10px] font-bold"
              >
                + Add Nutrition Row
              </button>
            </div>

            {nutritionRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Nutrient (e.g., Energy)"
                  value={row.key}
                  onChange={(e) => {
                    const updated = [...nutritionRows];
                    updated[idx].key = e.target.value;
                    setNutritionRows(updated);
                  }}
                  className="w-1/3 px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded text-stone-100 font-semibold"
                />
                <input
                  type="text"
                  placeholder="Amount (e.g., 898 kcal per 100g)"
                  value={row.value}
                  onChange={(e) => {
                    const updated = [...nutritionRows];
                    updated[idx].value = e.target.value;
                    setNutritionRows(updated);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded text-stone-200"
                />
                <button
                  type="button"
                  onClick={() => setNutritionRows(nutritionRows.filter((_, i) => i !== idx))}
                  className="p-1.5 text-stone-500 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-6 border-t border-stone-800">
            <button onClick={() => setCurrentStep(3)} className="px-4 py-2 bg-stone-800 rounded-xl">Back</button>
            <button onClick={handleFinish} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold rounded-xl text-xs shadow-lg">
              <Check className="h-4 w-4" /> Publish Product to Catalog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
