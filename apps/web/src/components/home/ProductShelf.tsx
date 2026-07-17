'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { FALLBACK_PRODUCTS, API_URL } from '../../lib/constants';
import ProductCard from '../product/ProductCard';

interface ProductShelfProps {
  onSubscribe: (product: any) => void;
}

export default function ProductShelf({ onSubscribe }: ProductShelfProps) {
  const { addToCart } = useApp();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // Disabling API call for the WhatsApp MVP launch until the backend is fully deployed
    // try {
    //   const res = await fetch(`${API_URL}/catalog/products`);
    //   const data = await res.json();
    //   if (Array.isArray(data) && data.length > 0) {
    //     setProducts(data);
    //   } else {
    //     setProducts(FALLBACK_PRODUCTS);
    //   }
    // } catch {
    //   setProducts(FALLBACK_PRODUCTS);
    // }
    setProducts(FALLBACK_PRODUCTS);
  };

  return (
    <section id="shop" className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="text-center max-w-xl mx-auto mb-14">
        <h2 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] mb-3">
          Our Bestsellers
        </h2>
        <div className="w-16 h-0.5 bg-[#C59B27] mx-auto" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={addToCart}
            onSubscribe={onSubscribe}
          />
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link 
          href="/products" 
          className="inline-flex items-center text-[#3A6038] font-bold hover:text-[#2d4d2b] transition group"
        >
          View All Products 
          <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    </section>
  );
}
