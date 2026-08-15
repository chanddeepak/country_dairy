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
export const ENABLE_SEARCH = false;

// WhatsApp ordering
export const WHATSAPP_NUMBER = '918291939317';
export const WHATSAPP_MESSAGE_TEMPLATE = (
  productName: string,
  price: string,
  variantName?: string,
  quantity: number = 1
) =>
  `Hi! I'd like to order:\n- ${quantity} x ${productName}${variantName ? ` (${variantName})` : ''} — ₹${price} each\nTotal Amount: ₹${Number(price) * quantity}\n\nPlease help me place this order. Thank you!`;

// Local product image map keyed by slug
export const PRODUCT_IMAGES: Record<string, any> = {
  'country-dairy-a2-cow-milk-1l': require('../assets/images/products/milk-bottle.jpg'),
  'country-dairy-a2-vedic-ghee-1l': require('../assets/images/products/ghee-jar.jpg'),
  'country-dairy-a2-gir-cow-ghee-1l': require('../assets/images/products/ghee-jar.jpg'),
  'organic-wood-pressed-mustard-oil-1l': require('../assets/images/products/mustard-oil.jpg'),
  'raw-wild-forest-honey-500g': require('../assets/images/products/wild-honey.jpg'),
};

export const HERO_IMAGE = require('../assets/images/hero-banner.png');
export const WHATSAPP_BANNER_IMAGE = require('../assets/images/whatsapp-banner.png');

// DB-Ready TypeScript Interfaces
export interface ProductVariant {
  id: string;
  name: string;
  volumeOrWeight: string;
  price: string;
  originalPrice?: string;
  discountPercent?: string;
  image?: any;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: string;
  originalPrice?: string;
  discountBadge?: string;
  badge?: string;
  imageUrls: any[];
  secondaryImages?: any[];
  variants: ProductVariant[];
  isSubscriptionAllowed: boolean;
  averageRating: number;
  totalReviews: number;
  nutritionFacts: Record<string, string>;
  metadata: Record<string, string>;
}

// Fallback product catalogue (used when API is offline)
export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 'c96dd14f-588a-4af6-bb9f-7341d2db72e1',
    name: 'Country Dairy A2 Cow Milk',
    slug: 'country-dairy-a2-cow-milk-1l',
    category: 'A2 Cow Milk',
    description: 'Pure A2 milk sourced from happy grass-fed cows. High fat, rich in A2 beta-casein.',
    price: '95',
    originalPrice: '110',
    discountBadge: '14% OFF',
    badge: 'Fresh Daily',
    imageUrls: [
      require('../assets/images/products/milk-bottle.jpg'),
      require('../assets/images/hero-banner.png'),
    ],
    secondaryImages: [require('../assets/images/hero-banner.png')],
    variants: [
      {
        id: 'milk-500ml',
        name: '500ml Glass Bottle',
        volumeOrWeight: '500ml',
        price: '50',
        originalPrice: '60',
        discountPercent: '16% OFF',
        image: require('../assets/images/products/milk-bottle.jpg'),
      },
      {
        id: 'milk-1l',
        name: '1L Glass Bottle',
        volumeOrWeight: '1L Bottle',
        price: '95',
        originalPrice: '110',
        discountPercent: '14% OFF',
        image: require('../assets/images/products/milk-bottle.jpg'),
        isDefault: true,
      },
      {
        id: 'milk-2l',
        name: '2L Family Canister',
        volumeOrWeight: '2L Canister',
        price: '185',
        originalPrice: '210',
        discountPercent: '12% OFF',
        image: require('../assets/images/products/milk-bottle.jpg'),
      },
    ],
    isSubscriptionAllowed: true,
    averageRating: 5.0,
    totalReviews: 12,
    nutritionFacts: { fat: '4.2%', energy: '64 kcal', calcium: '120mg', protein: '3.3g' },
    metadata: { volume: '1 Litre', packaging: 'Glass Bottle', shelfLife: '2 days' },
  },
  {
    id: '30c195de-b5dd-4510-b236-fb8224a9d00e',
    name: 'Country Dairy A2 Desi Cow Ghee',
    slug: 'country-dairy-a2-vedic-ghee-1l',
    category: 'A2 Desi Ghee',
    description: 'Every Spoon Carries the Soul of Devbhoomi.',
    price: '1450',
    originalPrice: '1600',
    discountBadge: '9% OFF',
    badge: '★ Best Seller',
    imageUrls: [
      require('../assets/images/products/ghee-jar.jpg'),
      require('../assets/images/hero-banner.png'),
    ],
    secondaryImages: [require('../assets/images/hero-banner.png')],
    variants: [
      {
        id: 'ghee-500ml',
        name: '500ml Glass Jar',
        volumeOrWeight: '500ml Jar',
        price: '750',
        originalPrice: '850',
        discountPercent: '12% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
      },
      {
        id: 'ghee-1l',
        name: '1L Glass Jar',
        volumeOrWeight: '1L Jar',
        price: '1450',
        originalPrice: '1600',
        discountPercent: '9% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
        isDefault: true,
      },
      {
        id: 'ghee-2.5l',
        name: '2.5L Traditional Dolchi',
        volumeOrWeight: '2.5L Dolchi',
        price: '3500',
        originalPrice: '3800',
        discountPercent: '8% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
      },
      {
        id: 'ghee-5l',
        name: '5L Traditional Dolchi',
        volumeOrWeight: '5L Dolchi',
        price: '6800',
        originalPrice: '7500',
        discountPercent: '9% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
      },
    ],
    isSubscriptionAllowed: false,
    averageRating: 4.9,
    totalReviews: 1810,
    nutritionFacts: { fat: '99.8g', energy: '897 kcal', cholesterol: '256mg' },
    metadata: { volume: '1 Litre', packaging: 'Glass Jar', shelfLife: '12 months' },
  },
  {
    id: 'f42dd18e-499b-4bc0-bb8e-8921a9db3621',
    name: 'Country Dairy A2 Gir Cow Ghee',
    slug: 'country-dairy-a2-gir-cow-ghee-1l',
    category: 'A2 Desi Ghee',
    description: 'Sourced exclusively from indigenous purebred Desi cows. Traditional bilona-churned in small batches from A2 cultured curd for golden purity.',
    price: '1450',
    originalPrice: '1600',
    discountBadge: '9% OFF',
    badge: '★ Premium Desi Breed',
    imageUrls: [
      require('../assets/images/products/ghee-jar.jpg'),
      require('../assets/images/hero-banner.png'),
    ],
    secondaryImages: [require('../assets/images/hero-banner.png')],
    variants: [
      {
        id: 'gir-ghee-500ml',
        name: '500ml Glass Jar',
        volumeOrWeight: '500ml Jar',
        price: '880',
        originalPrice: '980',
        discountPercent: '10% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
      },
      {
        id: 'gir-ghee-1l',
        name: '1L Glass Jar',
        volumeOrWeight: '1L Jar',
        price: '1650',
        originalPrice: '1800',
        discountPercent: '8% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
        isDefault: true,
      },
      {
        id: 'gir-ghee-2.5l',
        name: '2.5L Traditional Dolchi',
        volumeOrWeight: '2.5L Dolchi',
        price: '3950',
        originalPrice: '4300',
        discountPercent: '8% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
      },
      {
        id: 'gir-ghee-5l',
        name: '5L Traditional Dolchi',
        volumeOrWeight: '5L Dolchi',
        price: '7450',
        originalPrice: '8200',
        discountPercent: '9% OFF',
        image: require('../assets/images/products/ghee-jar.jpg'),
      },
    ],
    isSubscriptionAllowed: false,
    averageRating: 4.9,
    totalReviews: 1202,
    nutritionFacts: { fat: '99.8g', energy: '897 kcal', cholesterol: '250mg' },
    metadata: { volume: '1 Litre', packaging: 'Glass Jar', shelfLife: '12 months' },
  },
  {
    id: '7d6e35f1-e78f-4c72-843e-01764b4f3538',
    name: 'Organic Wood-Pressed Mustard Oil',
    slug: 'organic-wood-pressed-mustard-oil-1l',
    category: 'Wood-Pressed Oils',
    description: 'Cold wood-pressed kachi ghani mustard oil, chemical-free and rich in natural nutrients.',
    price: '320',
    originalPrice: '380',
    discountBadge: '16% OFF',
    badge: '★ Top Rated Choice',
    imageUrls: [
      require('../assets/images/products/mustard-oil.jpg'),
      require('../assets/images/hero-banner.png'),
    ],
    secondaryImages: [require('../assets/images/hero-banner.png')],
    variants: [
      {
        id: 'oil-500ml',
        name: '500ml Bottle',
        volumeOrWeight: '500ml Bottle',
        price: '170',
        originalPrice: '200',
        discountPercent: '15% OFF',
        image: require('../assets/images/products/mustard-oil.jpg'),
      },
      {
        id: 'oil-1l',
        name: '1L Bottle',
        volumeOrWeight: '1L Bottle',
        price: '320',
        originalPrice: '380',
        discountPercent: '16% OFF',
        image: require('../assets/images/products/mustard-oil.jpg'),
        isDefault: true,
      },
      {
        id: 'oil-5l',
        name: '5L Tin Can',
        volumeOrWeight: '5L Tin',
        price: '1550',
        originalPrice: '1850',
        discountPercent: '16% OFF',
        image: require('../assets/images/products/mustard-oil.jpg'),
      },
    ],
    isSubscriptionAllowed: false,
    averageRating: 4.8,
    totalReviews: 94,
    nutritionFacts: { fat: '100g', energy: '884 kcal', omega3: '11.6%' },
    metadata: { volume: '1 Litre', packaging: 'PET Bottle', shelfLife: '9 months' },
  },
  {
    id: 'e1c50580-58fb-464c-ae24-bad55488ce90',
    name: 'Raw Wild Forest Honey',
    slug: 'raw-wild-forest-honey-500g',
    category: 'Raw Honey',
    description: 'Unprocessed, unpasteurized honey collected by native tribes from deep forest hives.',
    price: '450',
    originalPrice: '520',
    discountBadge: '13% OFF',
    badge: '⚡ Selling Fast',
    imageUrls: [
      require('../assets/images/products/wild-honey.jpg'),
      require('../assets/images/hero-banner.png'),
    ],
    secondaryImages: [require('../assets/images/hero-banner.png')],
    variants: [
      {
        id: 'honey-250g',
        name: '250g Glass Jar',
        volumeOrWeight: '250g Jar',
        price: '240',
        originalPrice: '280',
        discountPercent: '14% OFF',
        image: require('../assets/images/products/wild-honey.jpg'),
      },
      {
        id: 'honey-500g',
        name: '500g Glass Jar',
        volumeOrWeight: '500g Jar',
        price: '450',
        originalPrice: '520',
        discountPercent: '13% OFF',
        image: require('../assets/images/products/wild-honey.jpg'),
        isDefault: true,
      },
      {
        id: 'honey-1kg',
        name: '1kg Glass Jar',
        volumeOrWeight: '1kg Jar',
        price: '850',
        originalPrice: '990',
        discountPercent: '14% OFF',
        image: require('../assets/images/products/wild-honey.jpg'),
      },
    ],
    isSubscriptionAllowed: false,
    averageRating: 4.9,
    totalReviews: 116,
    nutritionFacts: { sugar: '82.1g', energy: '304 kcal', carbohydrates: '82.4g' },
    metadata: { weight: '500g', packaging: 'Glass Jar', shelfLife: '18 months' },
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
          imageUrls: v.image ? [v.image] : prod.imageUrls,
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
