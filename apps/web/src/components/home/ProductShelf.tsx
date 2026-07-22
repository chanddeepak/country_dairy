'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { FALLBACK_PRODUCTS, Product, getExpandedProducts } from '../../lib/constants';
import ProductCard from '../product/ProductCard';

interface ProductShelfProps {
  onSubscribe: (product: Product) => void;
}

const CATEGORIES = [
  { id: 'All', label: 'All Products' },
  { id: 'A2 Desi Ghee', label: 'Ghee' },
  { id: 'Wood-Pressed Oils', label: 'Oils' },
  { id: 'A2 Cow Milk', label: 'Milk' },
  { id: 'Raw Honey', label: 'Honey' },
];

export default function ProductShelf({ onSubscribe }: ProductShelfProps) {
  const { addToCart } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    setProducts(FALLBACK_PRODUCTS);
  }, []);

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter((p) => p.category === activeCategory);

  return (
    <section id="shop" className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#2A2A2A] mb-2 leading-tight">
          Welcome To Country Dairy!
        </h2>
        <p className="font-serif italic text-lg sm:text-xl text-[#3A6038] font-medium">
          You're One Step Closer to Purity
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10 overflow-x-auto pb-2 scrollbar-none">
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

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={addToCart}
            onSubscribe={onSubscribe}
          />
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-12 text-center">
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
