'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
<<<<<<< HEAD
import { FALLBACK_PRODUCTS, API_URL, Product, getExpandedProducts } from '../../lib/constants';
import ProductCard from '../product/ProductCard';

interface ProductShelfProps {
  onSubscribe: (product: Product) => void;
}

const CATEGORIES = [
  { id: 'All', label: 'All Products' },
  { id: 'A2 Desi Ghee', label: 'Ghee' },
];

export default function ProductShelf({ onSubscribe }: ProductShelfProps) {
  const { addToCart } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/catalog/products?status=LIVE`);
      if (res.ok) {
        const liveProducts = await res.json();
        if (liveProducts && liveProducts.length > 0) {
          const mapped = liveProducts.map((p: any) => {
            const primaryImg = p.galleryImages?.find((img: any) => img.isPrimary)?.imageUrl 
              || p.galleryImages?.[0]?.imageUrl 
              || p.imageUrl 
              || '/images/products/milk-bottle.png';
            const defaultVariant = p.variants?.find((v: any) => v.isDefault) || p.variants?.[0];

            return {
              id: p.id,
              name: p.title || p.name,
              title: p.title || p.name,
              slug: p.slug,
              category: p.categoryName || (typeof p.category === 'string' ? p.category : p.category?.name) || 'Dairy',
              tagline: p.tagline || '',
              description: p.storyDescription || p.description || '',
              badgeText: p.badgeText || '',
              status: p.status || 'LIVE',
              isSubscriptionAllowed: p.isSubscriptionAllowed ?? false,
              price: String(defaultVariant?.sellingPrice || p.price || 100),
              originalPrice: String(defaultVariant?.mrpPrice || p.originalPrice || 120),
              imageUrls: p.galleryImages?.map((img: any) => img.imageUrl) || [primaryImg],
              galleryImages: p.galleryImages || [{ imageUrl: primaryImg, isPrimary: true }],
              variants: p.variants?.map((v: any) => ({
                id: v.id,
                name: v.sizeLabel || v.name || 'Standard Pack',
                volumeOrWeight: v.sizeLabel || v.name || '1 Litre',
                price: String(v.sellingPrice || v.price || 100),
                originalPrice: String(v.mrpPrice || v.originalPrice || 120),
                stockQuantity: v.stockQuantity ?? 50,
                packagingType: v.packagingType,
                isDefault: v.isDefault ?? false,
              })) || [],
            };
          });
          setProducts(mapped);
          return;
        }
      }
    } catch (err) {
      console.warn('API Server offline, using fallback products:', err);
    }
    const expanded = getExpandedProducts(FALLBACK_PRODUCTS);
    const primaryVariants = expanded.filter((p) => {
      const vol = p.metadata?.volume || p.name;
      if (vol.includes('2.5L')) return false;
      const isOil = p.category === 'Wood-Pressed Oils' || p.slug.includes('mustard-oil');
      if (isOil) {
        return vol.includes('1L');
      }
      return vol.includes('1L') || vol.includes('5L');
    });
    setProducts(primaryVariants);
  };

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter((p) => p.category === activeCategory);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section id="shop" className="scroll-mt-24 pt-10 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative">
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h2 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#2A2A2A] mb-2 leading-tight">
          Welcome To Country Dairy!
        </h2>
        <p className="font-serif italic text-lg sm:text-xl text-[#3A6038] font-medium">
          You're One Step Closer to Purity
        </p>
      </div>

      {/* Category Filter Tabs & Navigation Controls */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-none mx-auto sm:mx-0">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#3A6038] text-white shadow-sm'
                    : 'bg-white text-[#6b6661] hover:text-[#2A2A2A] border border-stone-200 hover:border-[#3A6038]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Scroll Navigation Buttons (Desktop) */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => handleScroll('left')}
            className="p-2.5 rounded-full bg-white border border-stone-200 text-[#2A2A2A] hover:bg-[#3A6038] hover:text-white hover:border-[#3A6038] transition shadow-sm"
            aria-label="Scroll Left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="p-2.5 rounded-full bg-white border border-stone-200 text-[#2A2A2A] hover:bg-[#3A6038] hover:text-white hover:border-[#3A6038] transition shadow-sm"
            aria-label="Scroll Right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Product Cards Single Row Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-6 overflow-x-auto pb-6 pt-1 scrollbar-none snap-x snap-mandatory touch-pan-x"
      >
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="w-[280px] sm:w-[310px] md:w-[320px] lg:w-[330px] flex-shrink-0 snap-start flex flex-col"
          >
            <ProductCard
              product={product}
              onAddToCart={addToCart}
              onSubscribe={onSubscribe}
            />
          </div>
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-10 text-center">
        <Link 
          href="/products" 
          className="inline-flex items-center text-[#3A6038] font-bold hover:text-[#2d4d2b] transition group text-sm uppercase tracking-wider bg-white border border-[#3A6038]/30 px-6 py-3 rounded-full hover:shadow-sm"
        >
          Explore Complete Catalog 
          <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    </section>
  );
}
