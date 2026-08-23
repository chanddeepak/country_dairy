'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FALLBACK_PRODUCTS, API_URL, Product, getExpandedProducts } from '../../lib/constants';
import { mapApiProducts, expandHomeVariants, isSoldOut } from '../../lib/mapProduct';
import ProductCard from '../product/ProductCard';

interface ProductShelfProps {
  onSubscribe: (product: Product) => void;
}

/**
 * The chips were hardcoded to 'A2 Desi Ghee', a category that does not exist.
 * The taxonomy calls it 'Dairy', so clicking Ghee filtered to nothing at all —
 * a shelf that looked broken because a label in the source disagreed with the
 * database.
 *
 * Derived from the products on the shelf instead, the same way /products does
 * it. A category cannot go stale if nobody writes it down twice, and a chip
 * can never filter to an empty shelf because it only exists if something is
 * under it.
 */
const ALL = 'All';

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
          // Flagged sizes get their own cards; everything else appears once.
          // The homepage is the shop window. Something nobody can buy has no
          // business in it — a customer who taps through only to be told it is
          // sold out has been sent on an errand for nothing.
          setProducts(
            expandHomeVariants(mapApiProducts(liveProducts)).filter((p) => !isSoldOut(p)),
          );
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

  const categories = [
    ALL,
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
  ];

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter((p) => p.category === activeCategory);

  // Arrows appear only when the row actually runs off the edge. With two
  // products on a desktop they were controls that scrolled nothing.
  const [overflow, setOverflow] = useState({ canScrollLeft: false, canScrollRight: false });

  const measureOverflow = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // 1px of slack: sub-pixel layout can leave scrollWidth a hair over
    // clientWidth on a row that visibly fits.
    setOverflow({
      canScrollLeft: el.scrollLeft > 1,
      canScrollRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  useEffect(() => {
    measureOverflow();

    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', measureOverflow, { passive: true });

    // Re-measure when the row or the window changes size, so switching
    // category or resizing does not leave a stale answer.
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(el);
    window.addEventListener('resize', measureOverflow);

    return () => {
      el.removeEventListener('scroll', measureOverflow);
      observer.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  }, [filteredProducts.length]);

  const canScroll = overflow.canScrollLeft || overflow.canScrollRight;

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
        <h2 className="font-serif font-normal text-2xl sm:text-3xl md:text-4xl text-[var(--ink)] mb-2 leading-tight">
          Welcome To Country Dairy!
        </h2>
        <p className="font-serif italic text-lg sm:text-xl text-[var(--forest)] font-medium">
          You're One Step Closer to Purity
        </p>
      </div>

      {/* Category Filter Tabs & Navigation Controls */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-none mx-auto sm:mx-0">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--forest)] text-white'
                    : 'bg-white text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-[var(--forest)]'
                }`}
              >
                {cat === ALL ? 'All Products' : cat}
              </button>
            );
          })}
        </div>

        {/* Only rendered when there is something off-screen to reach. */}
        {canScroll && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleScroll('left')}
              disabled={!overflow.canScrollLeft}
              className="p-2.5 rounded-full bg-white border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--forest)] hover:text-white hover:border-[var(--forest)] transition disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-[var(--ink)] disabled:hover:border-[var(--line)] disabled:cursor-default"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleScroll('right')}
              disabled={!overflow.canScrollRight}
              className="p-2.5 rounded-full bg-white border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--forest)] hover:text-white hover:border-[var(--forest)] transition disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-[var(--ink)] disabled:hover:border-[var(--line)] disabled:cursor-default"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
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
          className="inline-flex items-center text-[var(--forest)] font-bold hover:text-[var(--pine)] transition group text-sm uppercase tracking-wider bg-white border border-[var(--forest)]/30 px-6 py-3 rounded-full hover:shadow-sm"
        >
          Explore Complete Catalog 
          <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>
    </section>
  );
}
