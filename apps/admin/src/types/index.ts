export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'CATALOG_MANAGER' 
  | 'ORDER_MANAGER' 
  | 'DELIVERY_DRIVER' 
  | 'CUSTOMER';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
  isActive: boolean;
  metadata?: Record<string, any>;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED' | 'OUT_OF_STOCK';

export type PackagingType = 
  | 'GLASS_JAR' 
  | 'METAL_DOLCHI' 
  | 'FOOD_GRADE_TIN' 
  | 'PET_BOTTLE' 
  | 'ECO_POUCH';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  sizeLabel: string;
  sellingPrice: number;
  mrpPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  packagingType: PackagingType;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  altText?: string;
  displayOrder: number;
  isPrimary: boolean;
  createdAt?: string;
}

export interface Product {
  id: string;
  categoryId?: string;
  categoryName?: string;
  title: string;
  slug: string;
  tagline?: string;
  storyDescription?: string;
  status: ProductStatus;
  badgeText?: string;
  isFeatured: boolean;
  displayOrder: number;
  isSubscriptionAllowed?: boolean;
  batchCode?: string;
  verified?: boolean;
  nutritionFacts?: Record<string, string>;
  specifications?: Record<string, string>;
  metadata?: Record<string, any>;
  variants?: ProductVariant[];
  galleryImages?: ProductImage[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaLabel: string;
  ctaLink: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  overlayOpacity: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface FeatureFlags {
  ENABLE_WEBSITE_PAYMENT: boolean;
  ENABLE_PRODUCT_RATINGS: boolean;
  ENABLE_SUBSCRIPTIONS: boolean;
  ENABLE_CART: boolean;
  ENABLE_USER_ACCOUNTS: boolean;
}

export type CategoryItem = Category;

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  deviceType: 'DESKTOP' | 'MOBILE';
  ctaText: string;
  ctaLink: string;
  badgeText?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface TrustBadge {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
}

export interface LabCertificate {
  id: string;
  batchCode: string;
  productId?: string;
  pdfUrl: string;
  testDate: string;
  purityPercentage?: number;
  notes?: string;
  createdAt: string;
}
