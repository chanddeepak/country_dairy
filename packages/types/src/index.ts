export type Role = 'CUSTOMER' | 'ADMIN' | 'DELIVERY';

export interface User {
  id: string;
  email?: string;
  phone: string;
  name?: string;
  role: Role;
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  userId: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  imageUrls: string[];
  videoUrls: string[];
  isSubscriptionAllowed: boolean;
  nutritionFacts?: Record<string, string>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductReview {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  mediaUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}
