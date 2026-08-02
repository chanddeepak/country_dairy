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

// Feature flags
export const ENABLE_SUBSCRIPTIONS = false;
export const ENABLE_WEBSITE_PAYMENT = false;
export const ENABLE_USER_ACCOUNTS = false;
export const ENABLE_CART = false;
export const ENABLE_PRODUCT_RATINGS = false;

// WhatsApp ordering
export const WHATSAPP_NUMBER = '919997801112';
export const WHATSAPP_MESSAGE_TEMPLATE = (productName: string, price: string, variantName?: string, quantity: number = 1) =>
  `Hi! I'd like to order:\n- ${quantity} x ${productName}${variantName ? ` (${variantName})` : ''} — ₹${price} each\nTotal Amount: ₹${Number(price) * quantity}\n\nPlease help me place this order. Thank you!`;

export function resolveStorefrontImageUrl(url: string | undefined): string {
  if (!url) return '/images/products/ghee-jar.png';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cdnBase = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieugxahinfowtlryyzmv.supabase.co';
  if (url.startsWith('/')) {
    if (url.startsWith('/images/') || url.startsWith('/uploads/')) return url;
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
  price: string;
  originalPrice?: string;
  discountPercent?: string;
  image?: string;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  storyDescription?: string;
  price: string;
  originalPrice?: string;
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
    description: 'Made in our farms, our A2 Desi Cow Ghee is bilona-churned in small batches from A2 cultured curd. Pure, aromatic, and easy to digest.',
    storyDescription: 'Made on our farm, our A2 Desi Cow Ghee is crafted using the traditional Vedic bilona method. A2 cultured curd is slow-churned to yield pure makkhan, which is then gently heated in earthen pots to produce rich, golden ghee with an authentic granular texture and divine aroma.',
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
    nutritionFacts: { fat: '99.8g', energy: '897 kcal', cholesterol: '256mg' },
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
