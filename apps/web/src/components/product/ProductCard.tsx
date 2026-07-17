'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Calendar, MessageCircle } from 'lucide-react';
import { PRODUCT_IMAGES, ENABLE_SUBSCRIPTIONS, ENABLE_WEBSITE_PAYMENT, WHATSAPP_NUMBER, WHATSAPP_MESSAGE_TEMPLATE } from '../../lib/constants';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  imageUrls: string[];
  isSubscriptionAllowed: boolean;
  averageRating: number;
  totalReviews: number;
  metadata?: Record<string, string>;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string, quantity: number) => void;
  onSubscribe?: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart, onSubscribe }: ProductCardProps) {
  // Prefer local image, fallback to product's first imageUrl
  const imageSrc = PRODUCT_IMAGES[product.slug] || product.imageUrls?.[0] || '/images/products/milk-bottle.png';

  return (
    <div className="bg-white rounded-lg overflow-hidden group hover:shadow-lg transition-shadow duration-300 border border-stone-100 flex flex-col">
      {/* Product Image */}
      <Link href={`/products/${product.slug}`} className="relative aspect-square bg-[#f5f2ed] flex items-center justify-center overflow-hidden block">
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
      </Link>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-1 mb-2">
          <Star className="h-3.5 w-3.5 fill-[#C59B27] text-[#C59B27]" />
          <span className="text-xs font-bold text-[#2A2A2A]">{product.averageRating}</span>
          <span className="text-xs text-[#6b6661]">({product.totalReviews})</span>
        </div>

        <Link href={`/products/${product.slug}`} className="hover:text-[#3A6038] transition">
          <h3 className="font-serif font-bold text-base text-[#2A2A2A] leading-snug mb-1">
            {product.name}
          </h3>
        </Link>

        <p className="text-[#6b6661] text-xs leading-relaxed line-clamp-2 mb-4 flex-1">
          {product.description}
        </p>

        <div className="flex items-baseline justify-between mb-4">
          <span className="text-xl font-black text-[#2A2A2A]">₹{product.price}</span>
          <span className="text-xs text-[#6b6661] font-medium">
            {product.metadata?.volume || product.metadata?.weight || ''}
          </span>
        </div>

        <div className="space-y-2 mt-auto">
          {ENABLE_WEBSITE_PAYMENT && (
            <button
              onClick={() => onAddToCart(product.id, 1)}
              className="w-full bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition"
            >
              Add to Cart
            </button>
          )}
          
          {!ENABLE_WEBSITE_PAYMENT && (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_TEMPLATE(product.name, product.price))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-2.5 rounded-sm text-sm uppercase tracking-wider transition flex items-center justify-center"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Order on WhatsApp
            </a>
          )}
          
          {ENABLE_SUBSCRIPTIONS && product.isSubscriptionAllowed && onSubscribe && (
            <button
              onClick={() => onSubscribe(product)}
              className="w-full border border-[#3A6038] text-[#3A6038] hover:bg-[#3A6038]/5 font-bold py-2 rounded-sm text-xs flex items-center justify-center transition uppercase tracking-wider"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Subscribe & Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
