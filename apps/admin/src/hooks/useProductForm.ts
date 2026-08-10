import { useState } from 'react';
import type { CategoryItem } from '../pages/CategoryCMS';
import type { MediaType, Product, ProductImage, ProductStatus, ProductVariant } from '../types';

export const MAX_GALLERY_ITEMS = 10;

export type EditorTab = 'core' | 'variants' | 'gallery' | 'nutrition';

interface UseProductFormArgs {
  initialProduct?: Product;
  categories: CategoryItem[];
  onSave: (product: Product) => Promise<void> | void;
}

/**
 * All ProductEditor state and mutations in one place.
 *
 * The editor was a single 861-line component holding form state, gallery
 * management, the variant matrix and the save call together, and it accounted
 * for most of the bug-fix commits in this area. The tabs are now presentation
 * over this hook.
 */
export function useProductForm({ initialProduct, categories, onSave }: UseProductFormArgs) {
  const [activeTab, setActiveTab] = useState<EditorTab>('core');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Core details
  const [title, setTitle] = useState(initialProduct?.title ?? '');
  const [slug, setSlug] = useState(initialProduct?.slug ?? '');
  const [tagline, setTagline] = useState(initialProduct?.tagline ?? '');
  const [storyDescription, setStoryDescription] = useState(initialProduct?.storyDescription ?? '');
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status ?? 'DRAFT');
  const [badgeText, setBadgeText] = useState(initialProduct?.badgeText ?? '');
  const [categoryName, setCategoryName] = useState(
    initialProduct?.categoryName ?? categories[0]?.name ?? '',
  );
  const [forceOutOfStock, setForceOutOfStock] = useState(initialProduct?.forceOutOfStock ?? false);

  // Storefront specification fields
  const [servingSize, setServingSize] = useState(
    initialProduct?.specifications?.['Serving Size'] ?? '',
  );
  const [shelfLife, setShelfLife] = useState(initialProduct?.specifications?.['Shelf Life'] ?? '');
  const [storageInstructions, setStorageInstructions] = useState(
    initialProduct?.specifications?.['Storage Instructions'] ?? '',
  );

  const [variants, setVariants] = useState<ProductVariant[]>(initialProduct?.variants ?? []);

  const [galleryImages, setGalleryImages] = useState<ProductImage[]>(() => {
    const images = initialProduct?.galleryImages ?? [];
    const initialVariants = initialProduct?.variants ?? [];

    return images.map((img) => {
      const match = initialVariants.find((v) => v.imageUrl && v.imageUrl === img.imageUrl);
      return {
        ...img,
        variantId: img.variantId || (match ? match.sizeLabel : undefined),
        isVariantPrimary: img.isVariantPrimary ?? !!match,
      };
    });
  });

  const [nutritionFacts, setNutritionFacts] = useState<{ key: string; value: string }[]>(() =>
    initialProduct?.nutritionFacts
      ? Object.entries(initialProduct.nutritionFacts).map(([key, value]) => ({
          key,
          value: String(value),
        }))
      : [],
  );

  // --- Gallery ---

  const addGalleryItem = (url: string, mediaType: MediaType = 'IMAGE') => {
    if (!url) return;

    if (galleryImages.length >= MAX_GALLERY_ITEMS) {
      setError(`A product can have at most ${MAX_GALLERY_ITEMS} gallery items.`);
      return;
    }

    setError('');
    setGalleryImages((prev) => [
      ...prev,
      {
        id: `img-${Date.now()}`,
        productId: initialProduct?.id ?? '',
        imageUrl: url,
        mediaType,
        displayOrder: prev.length + 1,
        // A video cannot be the catalogue cover — a card needs a still.
        isPrimary: mediaType !== 'VIDEO' && prev.length === 0,
      },
    ]);
  };

  const setPrimaryImage = (id: string) =>
    setGalleryImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === id })));

  const deleteGalleryItem = (id: string) => {
    const target = galleryImages.find((i) => i.id === id);
    const remaining = galleryImages.filter((i) => i.id !== id);

    // Never leave the product without a cover image.
    if (target?.isPrimary) {
      const nextCover = remaining.find((i) => i.mediaType !== 'VIDEO');
      if (nextCover) nextCover.isPrimary = true;
    }

    setGalleryImages(remaining);
  };

  const assignImageToVariant = (imageId: string, variantIdOrLabel: string) =>
    setGalleryImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, variantId: variantIdOrLabel || undefined } : img,
      ),
    );

  const setVariantPrimaryImage = (variantIdOrLabel: string, imageUrl: string) => {
    setGalleryImages((prev) =>
      prev.map((img) => ({
        ...img,
        isVariantPrimary:
          img.variantId === variantIdOrLabel ? img.imageUrl === imageUrl : img.isVariantPrimary,
      })),
    );

    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantIdOrLabel || v.sizeLabel === variantIdOrLabel
          ? { ...v, imageUrl }
          : v,
      ),
    );
  };

  // --- Variants ---

  const addVariant = () =>
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}`,
        productId: initialProduct?.id ?? '',
        sku: '',
        sizeLabel: '',
        // Left at zero deliberately. Pre-filling a plausible price is how an
        // untouched row reaches the database with an invented number.
        sellingPrice: 0,
        mrpPrice: 0,
        stockQuantity: 0,
        lowStockThreshold: 10,
        packagingCode: null,
        isActive: true,
        displayOrder: prev.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

  const updateVariant = (index: number, patch: Partial<ProductVariant>) =>
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const deleteVariant = (id: string) => {
    if (variants.length <= 1) {
      setError('A product needs at least one variant.');
      return;
    }
    setError('');
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  // --- Nutrition ---

  const addNutritionRow = () => setNutritionFacts((prev) => [...prev, { key: '', value: '' }]);

  const updateNutritionRow = (index: number, patch: Partial<{ key: string; value: string }>) =>
    setNutritionFacts((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));

  const deleteNutritionRow = (index: number) =>
    setNutritionFacts((prev) => prev.filter((_, i) => i !== index));

  // --- Save ---

  /** Returns a message when something would be rejected by the API. */
  const validate = (): string | null => {
    if (!title.trim()) return 'Enter a product title.';
    if (!categoryName) return 'Choose a category.';
    if (variants.length === 0) return 'Add at least one variant.';

    for (const [i, v] of variants.entries()) {
      if (!v.sizeLabel.trim()) return `Variant ${i + 1} needs a size label.`;
      if (!v.sellingPrice || v.sellingPrice <= 0) {
        return `Variant ${i + 1} ("${v.sizeLabel}") needs a selling price.`;
      }
      if (!v.mrpPrice || v.mrpPrice <= 0) {
        return `Variant ${i + 1} ("${v.sizeLabel}") needs an MRP.`;
      }
    }

    return null;
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const nutritionObj: Record<string, string> = {};
      nutritionFacts.forEach((n) => {
        if (n.key.trim()) nutritionObj[n.key.trim()] = n.value.trim();
      });

      await onSave({
        id: initialProduct?.id ?? '',
        title,
        slug,
        tagline,
        storyDescription,
        status,
        forceOutOfStock,
        badgeText,
        categoryName,
        isFeatured: initialProduct?.isFeatured ?? false,
        displayOrder: initialProduct?.displayOrder ?? 1,
        galleryImages,
        variants,
        specifications: {
          ...(initialProduct?.specifications ?? {}),
          'Serving Size': servingSize,
          'Shelf Life': shelfLife,
          'Storage Instructions': storageInstructions,
        },
        nutritionFacts: nutritionObj,
        createdAt: initialProduct?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this product.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    isSaving,
    error,
    setError,

    core: {
      title,
      setTitle,
      slug,
      setSlug,
      tagline,
      setTagline,
      storyDescription,
      setStoryDescription,
      status,
      setStatus,
      badgeText,
      setBadgeText,
      categoryName,
      setCategoryName,
      forceOutOfStock,
      setForceOutOfStock,
      servingSize,
      setServingSize,
      shelfLife,
      setShelfLife,
      storageInstructions,
      setStorageInstructions,
    },

    gallery: {
      items: galleryImages,
      add: addGalleryItem,
      remove: deleteGalleryItem,
      setPrimary: setPrimaryImage,
      assignToVariant: assignImageToVariant,
      setVariantPrimary: setVariantPrimaryImage,
    },

    variantMatrix: {
      items: variants,
      add: addVariant,
      update: updateVariant,
      remove: deleteVariant,
    },

    nutrition: {
      rows: nutritionFacts,
      add: addNutritionRow,
      update: updateNutritionRow,
      remove: deleteNutritionRow,
    },

    save,
  };
}

export type ProductFormState = ReturnType<typeof useProductForm>;
