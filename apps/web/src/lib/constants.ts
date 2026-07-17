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

// WhatsApp ordering
export const WHATSAPP_NUMBER = '918291939317';
export const WHATSAPP_MESSAGE_TEMPLATE = (productName: string, price: string) =>
  `Hi! I'd like to order:\n📦 ${productName} — ₹${price}\nPlease help me place this order. Thank you!`;

// Local product image map keyed by slug
export const PRODUCT_IMAGES: Record<string, string> = {
  'country-dairy-a2-cow-milk-1l': '/images/products/milk-bottle.png',
  'country-dairy-a2-vedic-ghee-1l': '/images/products/ghee-jar.png',
  'organic-wood-pressed-mustard-oil-1l': '/images/products/mustard-oil.png',
  'raw-wild-forest-honey-500g': '/images/products/wild-honey.png',
};

export const HERO_IMAGE = '/images/hero-banner.png';

// Fallback product catalogue (used when API is offline)
export const FALLBACK_PRODUCTS = [
  {
    id: 'c96dd14f-588a-4af6-bb9f-7341d2db72e1',
    name: 'Country Dairy A2 Cow Milk',
    slug: 'country-dairy-a2-cow-milk-1l',
    description: 'Pure A2 milk sourced from happy grass-fed cows. High fat, rich in A2 beta-casein.',
    price: '95',
    imageUrls: ['/images/products/milk-bottle.png'],
    isSubscriptionAllowed: true,
    averageRating: 5,
    totalReviews: 12,
    nutritionFacts: { fat: '4.2%', energy: '64 kcal', calcium: '120mg', protein: '3.3g' },
    metadata: { volume: '1 Litre', packaging: 'Glass Bottle', shelfLife: '2 days' },
  },
  {
    id: '30c195de-b5dd-4510-b236-fb8224a9d00e',
    name: 'Country Dairy A2 Vedic Ghee',
    slug: 'country-dairy-a2-vedic-ghee-1l',
    description: 'Premium A2 Ghee made using traditional Bilona churning method from A2 curd.',
    price: '1450',
    imageUrls: ['/images/products/ghee-jar.png'],
    isSubscriptionAllowed: false,
    averageRating: 4.8,
    totalReviews: 43,
    nutritionFacts: { fat: '99.8g', energy: '897 kcal', cholesterol: '256mg' },
    metadata: { volume: '1 Litre', packaging: 'Glass Jar', shelfLife: '12 months' },
  },
  {
    id: '7d6e35f1-e78f-4c72-843e-01764b4f3538',
    name: 'Organic Wood-Pressed Mustard Oil',
    slug: 'organic-wood-pressed-mustard-oil-1l',
    description: 'Cold wood-pressed kachi ghani mustard oil, chemical-free and rich in natural nutrients.',
    price: '320',
    imageUrls: ['/images/products/mustard-oil.png'],
    isSubscriptionAllowed: false,
    averageRating: 4.5,
    totalReviews: 8,
    nutritionFacts: { fat: '100g', energy: '884 kcal', omega3: '11.6%' },
    metadata: { volume: '1 Litre', packaging: 'PET Bottle', shelfLife: '9 months' },
  },
  {
    id: 'e1c50580-58fb-464c-ae24-bad55488ce90',
    name: 'Raw Wild Forest Honey',
    slug: 'raw-wild-forest-honey-500g',
    description: 'Unprocessed, unpasteurized honey collected by native tribes from deep forest hives.',
    price: '450',
    imageUrls: ['/images/products/wild-honey.png'],
    isSubscriptionAllowed: false,
    averageRating: 4.9,
    totalReviews: 19,
    nutritionFacts: { sugar: '82.1g', energy: '304 kcal', carbohydrates: '82.4g' },
    metadata: { weight: '500g', packaging: 'Glass Jar', shelfLife: '18 months' },
  },
];
