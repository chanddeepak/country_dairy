// Brand color tokens
export const COLORS = {
  forest: '#3A6038',
  forestDark: '#2d4d2b',
  gold: '#C59B27',
  goldDark: '#b08b22',
  cream: '#FAF8F3',
  charcoal: '#2A2A2A',
  muted: '#6b6661',
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Feature flags live in the database (FeatureFlag table) and are read through
// StoreConfigContext. Hardcoding them here meant the storefront and the admin
// console could disagree about what was switched on.

// WhatsApp ordering config now lives in the database (StoreSetting) and is
// read via StoreConfigContext, so the number is editable from the admin
// console and cannot diverge between the web and mobile apps.

export function resolveStorefrontImageUrl(url?: string | null): string {
  if (!url) return '/images/products/ghee-jar.png';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cdnBase = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (url.startsWith('/hero-banners/') || url.startsWith('/products/')) {
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
export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: '30c195de-b5dd-4510-b236-fb8224a9d00e',
    name: 'A2 Desi Cow Ghee',
    slug: 'country-dairy-a2-vedic-ghee-1l',
    category: 'A2 Desi Ghee',
    description: 'Every Spoon Carries the Soul of Devbhoomi.',
    storyDescription: 'Handcrafted in the serene foothills of Uttarakhand, Country Dairy Desi Cow Ghee celebrates the timeless traditions of Devbhoomi. Made through the traditional curd-to-butter process and slowly simmered to perfection, every jar carries the rich aroma, authentic taste, and wholesome goodness that has been cherished in pahadi homes for generations.\n\nFrom nourishing daily meals to festive celebrations, this golden ghee brings the warmth of the mountains and the purity of nature to every kitchen.\n\nPure. Traditional. Himalayan.\n\nEvery Spoon Carries the Soul of Devbhoomi.',
    price: '1450',
    originalPrice: '1600',
    discountBadge: '9% OFF',
    badge: '★ Best Seller',
    imageUrls: [
      '/images/products/ghee-gallery-banner-v2.png',
      '/images/products/ghee-gallery-purity-v2.png',
      '/images/products/ghee-gallery-uses-v2.png',
      '/images/products/ghee-gallery-nutrition-v2.png',
    ],
    secondaryImages: [
      '/images/products/ghee-gallery-banner-v2.png',
      '/images/products/ghee-gallery-purity-v2.png',
      '/images/products/ghee-gallery-uses-v2.png',
      '/images/products/ghee-gallery-nutrition-v2.png',
    ],
    variants: [
      {
        id: 'ghee-500ml',
        name: '500ml Glass Jar',
        volumeOrWeight: '500ml Jar',
        price: '750',
        originalPrice: '850',
        discountPercent: '12% OFF',
        image: '/images/products/a2-desi-ghee-500ml.png',
      },
      {
        id: 'ghee-1l',
        name: '1L Glass Jar',
        volumeOrWeight: '1L Jar',
        price: '1450',
        originalPrice: '1600',
        discountPercent: '9% OFF',
        image: '/images/products/a2-desi-ghee-v2.png',
        isDefault: true,
      },
      {
        id: 'ghee-2.5l',
        name: '2.5L Traditional Dolchi',
        volumeOrWeight: '2.5L Dolchi',
        price: '3500',
        originalPrice: '3800',
        discountPercent: '8% OFF',
        image: '/images/products/a2-desi-ghee-2-5l.png',
      },
      {
        id: 'ghee-5l',
        name: '5L Traditional Dolchi',
        volumeOrWeight: '5L Dolchi',
        price: '6800',
        originalPrice: '7500',
        discountPercent: '9% OFF',
        image: '/images/products/a2-desi-ghee-5l.png',
      },
    ],
    isSubscriptionAllowed: false,
    averageRating: 4.9,
    totalReviews: 1810,
    nutritionFacts: {
      servingSize: '1 Tbsp (14g)',
      servingsPerContainer: '65',
      calories: '717 kcal',
      totalFat: '81g (125% DV)',
      saturatedFat: '51g (257% DV)',
      transFat: '0g',
      cholesterol: '215mg (72% DV)',
      sodium: '11mg (0% DV)',
      carbohydrates: '0g',
      protein: '1g',
      vitaminA: '50% DV',
      calcium: '2% DV',
    },
    metadata: { volume: '1 Litre', packaging: 'Glass Jar', shelfLife: '12 months' },
  },
];

// Helper to expand every variant of every product into a standalone display item for product catalog grids
export function getExpandedProducts(products: Product[]): Product[] {
  const expanded: Product[] = [];
  products.forEach((prod) => {
    if (!prod.variants || prod.variants.length === 0) {
      expanded.push(prod);
    } else {
      prod.variants.forEach((v) => {
        expanded.push({
          ...prod,
          id: `${prod.id}-${v.id}`,
          name: `${prod.name} - ${v.volumeOrWeight}`,
          price: v.price,
          originalPrice: v.originalPrice || prod.originalPrice,
          discountBadge: v.discountPercent || prod.discountBadge,
          imageUrls: v.image ? [v.image, ...(prod.secondaryImages || [])] : prod.imageUrls,
          metadata: {
            ...prod.metadata,
            volume: v.volumeOrWeight,
          },
          variants: prod.variants.map((vOpt) => ({
            ...vOpt,
            isDefault: vOpt.id === v.id,
          })),
        });
      });
    }
  });
  return expanded;
}
