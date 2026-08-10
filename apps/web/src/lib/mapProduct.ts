// Maps an API product onto the shape the storefront components render.
//
// This existed twice, copied between the products page and the homepage shelf,
// and both copies invented values the API had simply not sent:
//
//   price:         String(v.sellingPrice || p.price || 100)
//   stockQuantity: v.stockQuantity ?? 50
//
// The stock default was the dangerous one — a variant with 0 stock read as 50,
// so a sold-out product rendered as buyable, the out-of-stock overlay never
// appeared, and the customer only found out at checkout.
//
// Nothing here substitutes a value. A field the API omits stays undefined so
// the UI can show it as unknown rather than as a confident wrong number.
import type { Product } from './constants';

interface ApiVariant {
  id: string;
  sizeLabel?: string;
  name?: string;
  sellingPrice?: number | string;
  mrpPrice?: number | string;
  stockQuantity?: number;
  packagingCode?: string | null;
  imageUrl?: string | null;
  isDefault?: boolean;
  displayOrder?: number;
}

interface ApiProduct {
  id: string;
  title?: string;
  name?: string;
  slug: string;
  tagline?: string;
  storyDescription?: string;
  description?: string;
  badgeText?: string;
  status?: string;
  forceOutOfStock?: boolean;
  isSubscriptionAllowed?: boolean;
  categoryName?: string;
  category?: string | { name?: string };
  averageRating?: number;
  totalReviews?: number;
  galleryImages?: { imageUrl: string; isPrimary?: boolean; variantId?: string | null }[];
  variants?: ApiVariant[];
}

const FALLBACK_IMAGE = '/images/products/milk-bottle.png';

function discountPercent(selling?: number, mrp?: number): string {
  if (!selling || !mrp || mrp <= selling) return '';
  return `${Math.round(((mrp - selling) / mrp) * 100)}% OFF`;
}

export function mapApiProduct(p: ApiProduct): Product {
  const primaryImg =
    p.galleryImages?.find((img) => img.isPrimary)?.imageUrl ||
    p.galleryImages?.[0]?.imageUrl ||
    FALLBACK_IMAGE;

  const variants = (p.variants ?? []).map((v) => {
    const selling = v.sellingPrice !== undefined ? Number(v.sellingPrice) : undefined;
    const mrp = v.mrpPrice !== undefined ? Number(v.mrpPrice) : undefined;

    return {
      id: v.id,
      name: v.sizeLabel || v.name || 'Standard Pack',
      volumeOrWeight: v.sizeLabel || v.name || '',
      price: selling !== undefined ? String(selling) : '',
      originalPrice: mrp !== undefined ? String(mrp) : '',
      discountPercent: discountPercent(selling, mrp),
      // Carried through as-is. Treating a missing value as "plenty in stock"
      // is how sold-out items became orderable.
      stockQuantity: v.stockQuantity,
      packagingCode: v.packagingCode ?? undefined,
      image: v.imageUrl ?? undefined,
      isDefault: v.isDefault ?? false,
    };
  });

  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];

  return {
    id: p.id,
    name: p.title || p.name || 'Product',
    title: p.title || p.name,
    slug: p.slug,
    category:
      p.categoryName ||
      (typeof p.category === 'string' ? p.category : p.category?.name) ||
      '',
    tagline: p.tagline ?? '',
    description: p.storyDescription || p.description || '',
    badgeText: p.badgeText ?? '',
    badge: p.badgeText ?? '',
    status: p.status ?? 'LIVE',
    forceOutOfStock: p.forceOutOfStock ?? false,
    isSubscriptionAllowed: p.isSubscriptionAllowed ?? false,
    price: defaultVariant?.price ?? '',
    originalPrice: defaultVariant?.originalPrice ?? '',
    discountBadge: defaultVariant?.discountPercent ?? '',
    // Previously dropped, which is why every card rendered "⭐ ()".
    averageRating: p.averageRating,
    totalReviews: p.totalReviews,
    imageUrls: p.galleryImages?.map((img) => img.imageUrl) ?? [primaryImg],
    galleryImages: p.galleryImages ?? [{ imageUrl: primaryImg, isPrimary: true }],
    variants,
  } as unknown as Product;
}

export function mapApiProducts(products: ApiProduct[]): Product[] {
  return products.map(mapApiProduct);
}
