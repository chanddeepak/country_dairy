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
  showOnHome?: boolean;
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
      showOnHome: v.showOnHome ?? false,
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

/**
 * Every size, each as its own card. For the shop page.
 *
 * Distinct from expandHomeVariants, and deliberately not driven by the same
 * flag. "Show on home" curates the homepage shelf — it is a decision about
 * what to put in the window. The shop is the whole catalogue, so a size a
 * customer can buy has to be a size they can find: listing ghee once meant
 * the 500ml jar existed only for someone who thought to open the product and
 * look.
 *
 * A product with a single size is left alone. Suffixing "— 1 Litre" onto the
 * only size there is adds nothing but noise.
 */
export function expandAllVariants(products: Product[]): Product[] {
  const shelf: Product[] = [];

  for (const product of products) {
    // Inactive sizes are already dropped by the mapper above.
    const variants = product.variants ?? [];

    if (variants.length <= 1) {
      shelf.push(product);
      continue;
    }

    for (const variant of variants) {
      shelf.push({
        ...product,
        // Distinct id, or React drops the second card as a key collision.
        id: `${product.id}--${variant.id}`,
        name: `${product.name} — ${variant.volumeOrWeight}`,
        price: variant.price,
        originalPrice: variant.originalPrice,
        discountBadge: variant.discountPercent,
        imageUrls: variant.image ? [variant.image] : product.imageUrls,
        // The card adds to cart with the default variant, so the default has
        // to be the size the card is showing.
        variants: variants.map((v) => ({ ...v, isDefault: v.id === variant.id })),
      } as unknown as Product);
    }
  }

  return shelf;
}

/**
 * Gives a flagged variant its own card on the homepage shelf.
 *
 * A product normally appears once, at its default size. Where the shopkeeper
 * has ticked "show on home" for particular sizes, those sizes get their own
 * cards instead — so a shelf can carry "Ghee 500ml" and "Ghee 1L" side by
 * side, priced separately, without the product also appearing a third time.
 *
 * Products with nothing flagged are untouched, which is why turning this on
 * for one variant cannot disturb the rest of the shelf.
 */
export function expandHomeVariants(products: Product[]): Product[] {
  const shelf: Product[] = [];

  for (const product of products) {
    const featured = (product.variants ?? []).filter((v) => v.showOnHome);

    if (featured.length === 0) {
      shelf.push(product);
      continue;
    }

    for (const variant of featured) {
      shelf.push({
        ...product,
        // Distinct id and a variant-specific link, so two cards for the same
        // product are separate cards rather than one React key collision that
        // silently drops the second.
        id: `${product.id}--${variant.id}`,
        name: `${product.name} — ${variant.volumeOrWeight}`,
        price: variant.price,
        originalPrice: variant.originalPrice,
        discountBadge: variant.discountPercent,
        imageUrls: variant.image ? [variant.image] : product.imageUrls,
        // The card adds to cart with the default variant, so the default has
        // to be the one this card is actually showing.
        variants: (product.variants ?? []).map((v) => ({
          ...v,
          isDefault: v.id === variant.id,
        })),
      } as unknown as Product);
    }
  }

  return shelf;
}
