export type Role = 'CUSTOMER' | 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'ORDER_MANAGER' | 'DELIVERY_DRIVER';

export type ProductStatus = 'LIVE' | 'DRAFT' | 'OUT_OF_STOCK' | 'ARCHIVED';

export type PackagingType = 'GLASS_JAR' | 'METAL_DOLCHI' | 'FOOD_GRADE_TIN' | 'PET_BOTTLE' | 'ECO_POUCH';

export interface User {
  id: string;
  email?: string;
  phone: string;
  name?: string;
  role: Role;
  walletBalance: number;
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
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  categoryId?: string;
  categoryName?: string;
  title: string;
  slug: string;
  tagline?: string;
  storyDescription?: string;
  status?: ProductStatus;
  badgeText?: string;
  isFeatured?: boolean;
  displayOrder?: number;
  isSubscriptionAllowed?: boolean;
  batchCode?: string;
  verified?: boolean;
  galleryImages?: ProductImage[];
  variants?: ProductVariant[];
  nutritionFacts?: Record<string, string>;
  specifications?: Record<string, string>;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
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

export interface AuditLog {
  id: string;
  userId?: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  payloadBefore?: any;
  payloadAfter?: any;
  ipAddress?: string;
  createdAt: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
}

export * from './hero-layout';
