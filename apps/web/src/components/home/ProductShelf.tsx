'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { API_URL, Product } from '../../lib/constants';
import { mapApiProducts, expandHomeVariants, isSoldOut } from '../../lib/mapProduct';
import ProductCard from '../product/ProductCard';
import ContourField from '../ui/ContourField';

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

/**
 * As many columns as there is content for, to a maximum of four.
 *
 * The shelf used to be a horizontal carousel of fixed 330px cards. With two
 * products on a desktop that is 660px of shop in a 1216px band, and the rest
 * empty — which is most of why the products read as lost between the story
 * sections. The last cell is always the way through to the full catalogue, so
 * the row is never short of something to fill it.
 */
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

export default function ProductShelf({ onSubscribe }: ProductShelfProps) {
  const { addToCart } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  // Distinguishes "not fetched yet" from "fetched and there is nothing", so the
  // shelf does not blink out of the page on every first paint.
  const [settled, setSettled] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
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
          setSettled(true);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not load the shelf:', err);
    }
    /*
     * Nothing to show rather than something invented.
     *
     * This used to fall back to a hardcoded list with hardcoded prices. The
     * shelf is one band of the homepage, so an empty one costs a scroll; a
     * wrong one costs a customer who taps a price we are not charging.
     */
    setProducts([]);
    setSettled(true);
  };

  const categories = [
    ALL,
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
  ];

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter((p) => p.category === activeCategory);

  const cells = Math.min(filteredProducts.length + 1, 4);

  /*
   * A shelf with nothing on it is a hole in the page, so it is not drawn at
   * all. The nav still links to #shop; landing on the band below it is a
   * smaller wrong than landing on an empty promise.
   */
  if (settled && products.length === 0) return null;

  return (
    <section id="shop" className="scroll-mt-24 bg-[var(--cream)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-text)]">
              Shop
            </p>
            <h2 className="max-w-[18ch] font-serif text-[clamp(28px,4vw,46px)] font-light leading-[1.08] tracking-[-0.012em] text-[var(--ink)]">
              Everything we bring down from the hills.
            </h2>
          </div>
          <Link
            href="/products"
            data-testid="shelf-shop-all"
            className="inline-flex items-center rounded-sm border border-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forest)] transition-colors duration-300 hover:bg-[var(--forest)] hover:text-[var(--ivory)]"
          >
            Shop all
          </Link>
        </div>

        {/* Derived from the shelf, never written down twice. Kept even when
            there is a single category, because a chip per shelf is a contract
            the taxonomy test relies on. */}
        <div className="mb-9 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap rounded-full px-5 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-200 ${
                  isActive
                    ? 'bg-[var(--forest)] text-[var(--ivory)]'
                    : 'border border-[var(--line)] bg-[var(--ivory)] text-[var(--ink-soft)] hover:border-[var(--forest)] hover:text-[var(--forest)]'
                }`}
              >
                {cat === ALL ? 'All Products' : cat}
              </button>
            );
          })}
        </div>

        <div className={`grid gap-x-6 gap-y-10 ${COLUMNS[cells] ?? COLUMNS[4]}`}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={addToCart}
              onSubscribe={onSubscribe}
            />
          ))}

          {/* The last cell is a door, not a gap. */}
          <Link
            href="/products"
            className="group relative flex flex-col justify-end overflow-hidden bg-[var(--forest)] p-7"
          >
            <ContourField tone="brass" spacing={40} opacity={0.18} className="absolute inset-0" />
            <div className="relative">
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--brass-on-dark)]">
                The full catalogue
              </p>
              <p className="font-serif text-[24px] leading-snug text-[var(--ivory)]">
                Every size, every shelf.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ivory)]">
                Shop all
                <span className="transition-transform duration-300 group-hover:translate-x-1">&#8594;</span>
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
