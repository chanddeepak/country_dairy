// Brand color tokens
export const COLORS = {
  forest: 'var(--forest)',
  forestDark: 'var(--pine)',
  gold: 'var(--brass)',
  goldDark: 'var(--pine)',
  cream: 'var(--ivory)',
  charcoal: 'var(--ink)',
  muted: 'var(--ink-soft)',
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Where this site lives, for the things that must be absolute.
 *
 * Canonical links, Open Graph URLs and the sitemap are all read off-site, by a
 * crawler or a chat app that has no idea what host served the page — a
 * relative URL in any of them is useless. Next resolves them against
 * `metadataBase`, which is set from this.
 *
 * The apex, not www: the CORS list allows both, so one has to be named as the
 * canonical one or the two compete for the same rankings.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://countrydairy.in'
).replace(/\/$/, '');

// Feature flags live in the database (FeatureFlag table) and are read through
// StoreConfigContext. Hardcoding them here meant the storefront and the admin
// console could disagree about what was switched on.

// WhatsApp ordering config now lives in the database (StoreSetting) and is
// read via StoreConfigContext, so the number is editable from the admin
// console and cannot diverge between the web and mobile apps.

const PLACEHOLDER_IMAGE = '/images/products/ghee-jar.png';
let warnedAboutMissingCdn = false;

export function resolveStorefrontImageUrl(url?: string | null): string {
  if (!url) return PLACEHOLDER_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cdnBase = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  // An object-storage path with no host to put in front of it resolves against
  // the storefront itself — /storage/v1/... on localhost:3000 — which 404s and
  // looks like the image is missing rather than the configuration. Say so once
  // and fall back to the placeholder.
  if (!cdnBase && url.startsWith('/storage/v1/')) {
    if (!warnedAboutMissingCdn) {
      warnedAboutMissingCdn = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[images] NEXT_PUBLIC_SUPABASE_URL is not set, so stored images cannot ' +
          'be located. Set it in apps/web/.env.local for local development.',
      );
    }
    return PLACEHOLDER_IMAGE;
  }
  if (url.startsWith('/hero-banners/') || url.startsWith('/products/')) {
    if (!cdnBase) {
      if (!warnedAboutMissingCdn) {
        warnedAboutMissingCdn = true;
        // eslint-disable-next-line no-console
        console.warn(
          '[images] NEXT_PUBLIC_SUPABASE_URL is not set, so stored images cannot ' +
            'be located. Set it in apps/web/.env.local for local development.',
        );
      }
      return PLACEHOLDER_IMAGE;
    }
    return `${cdnBase}/storage/v1/object/public${url}`;
  }
  if (url.startsWith('/storage/v1/object/public/')) {
    return `${cdnBase}${url}`;
  }
  if (url.startsWith('/uploads/')) {
    const apiHost = API_URL.replace(/\/api\/?$/, '');
    return `${apiHost}${url}`;
  }
  if (url.startsWith('/')) {
    if (url.startsWith('/images/')) return url;
    return `${cdnBase}/storage/v1/object/public${url}`;
  }
  return `${cdnBase}/storage/v1/object/public/${url}`;
}

// Local product image map keyed by slug
export const PRODUCT_IMAGES: Record<string, string> = {
  'country-dairy-a2-cow-milk-1l': '/images/products/milk-bottle.png',
  'country-dairy-a2-vedic-ghee-1l': '/images/products/a2-desi-ghee-v2.png',
  'raw-wild-forest-honey-500g': '/images/products/wild-honey.png',
};

export const HERO_IMAGE = '/images/hero-banner-v2.png';

// DB-Ready TypeScript Interfaces
export interface ProductVariant {
  id: string;
  name: string;
  volumeOrWeight: string;
  /** Null when the API sent none. Never substitute a figure for it. */
  price: string | null;
  originalPrice?: string | null;
  discountPercent?: string;
  image?: string;
  isDefault?: boolean;
  /** Ticked in the admin console to give this size its own homepage card. */
  showOnHome?: boolean;
  /**
   * Null means the API did not say, which is not the same as zero. Unknown is
   * treated as available and the server remains the authority; a known zero is
   * never offered for sale.
   */
  stockQuantity?: number | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  tagline?: string;
  storyDescription?: string;
  /**
   * Null when the API sent no price. A missing figure is shown as unknown and
   * the product cannot be bought — never replaced with a plausible default,
   * which is how a customer was once quoted ₹100 nobody had set.
   */
  price: string | null;
  originalPrice?: string | null;
  discountBadge?: string;
  badge?: string;
  imageUrls: string[];
  secondaryImages?: string[];
  variants: ProductVariant[];
  isSubscriptionAllowed: boolean;
  averageRating: number;
  totalReviews: number;
  nutritionFacts: Record<string, string>;
  metadata: Record<string, string>;
}

// Fallback product catalogue (DB-Ready structure with universal product variants and multiple gallery images)
