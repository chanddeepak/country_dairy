'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ProductCard from '../../components/product/ProductCard';
import AuthModal from '../../components/modals/AuthModal';
import SubscriptionModal from '../../components/modals/SubscriptionModal';
import CartDrawer from '../../components/cart/CartDrawer';
import { FALLBACK_PRODUCTS, API_URL, getExpandedProducts } from '../../lib/constants';
import { mapApiProducts, expandAllVariants, isSoldOut } from '../../lib/mapProduct';
import FilterDrawer, {
  FilterButton,
  countSelected,
  type FilterGroup,
  type Selection,
} from '../../components/product/FilterDrawer';
import {
  buildFilterGroups,
  filterChipLabel,
  matchesSelection,
  toggleInSelection,
} from '../../lib/productFilters';
import { X } from 'lucide-react';
import { useStoreConfig } from '../../context/StoreConfigContext';

const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low → High', value: 'price-asc' },
  { label: 'Price: High → Low', value: 'price-desc' },
  { label: 'Rating', value: 'rating' },
];

export default function ProductsClient({
  initialProducts,
}: {
  /** Raw catalogue rows, fetched on the server. */
  initialProducts: any[] | null;
}) {
  const { isFlagOn } = useStoreConfig();
  const ENABLE_PRODUCT_RATINGS = isFlagOn('ENABLE_PRODUCT_RATINGS');
  const { user, addToCart } = useApp();
  /*
   * Seeded from the server, so the cards — and the links to every product —
   * are in the first response. This started empty and was filled by an effect,
   * which is why a crawler that does not run JavaScript could not walk from
   * here to a single product page.
   */
  const seeded = useMemo(
    () => (initialProducts?.length ? expandAllVariants(mapApiProducts(initialProducts)) : null),
    [initialProducts],
  );

  const [products, setProducts] = useState<any[]>(seeded ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  // Built from the Category table via each product's categoryName, rather
  // than the hardcoded ['All', 'Ghee'] which matched nothing in the taxonomy.
  const [categories, setCategories] = useState<string[]>(
    seeded
      ? ['All', ...Array.from(new Set(seeded.map((p) => p.category).filter(Boolean) as string[])).sort()]
      : ['All'],
  );
  const [sortBy, setSortBy] = useState('relevance');
  const [selection, setSelection] = useState<Selection>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Modal state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubscrOpen, setIsSubscrOpen] = useState(false);
  const [subscrProduct, setSubscrProduct] = useState<any>(null);

  useEffect(() => {
    // The server already sent them; fetching again would replace the cards
    // with identical ones.
    if (seeded) return;
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/catalog/products?status=LIVE`);
      if (res.ok) {
        const liveProducts = await res.json();
        if (liveProducts && liveProducts.length > 0) {
          // One card per size. Listing ghee once hid the 500ml jar from
          // anyone who did not think to open the product and look.
          const mapped = expandAllVariants(mapApiProducts(liveProducts));
          setProducts(mapped);

          // Only categories that actually have live products get a chip.
          const present = Array.from(
            new Set(mapped.map((p) => p.category).filter(Boolean) as string[]),
          ).sort();
          setCategories(['All', ...present]);
          return;
        }
      }
    } catch (err) {
      console.warn('API Server offline, using fallback products:', err);
    }
    setProducts(getExpandedProducts(FALLBACK_PRODUCTS));
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    // Category filter — an exact match on the product's own category, no
    // guessing from the product name.
    if (activeCategory !== 'All') {
      result = result.filter((p) => {
        const cat = (typeof p.category === 'string' ? p.category : p.category?.name) || '';
        return cat === activeCategory;
      });
    }

    // Type, size and availability. Category stays a chip above — it is how
    // someone browses here, where the others refine what browsing found.
    result = result.filter((p) => matchesSelection(p, selection));

    // Sort
    if (sortBy === 'price-asc') result.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === 'price-desc') result.sort((a, b) => Number(b.price) - Number(a.price));
    if (sortBy === 'rating') result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

    return result;
  }, [products, searchQuery, activeCategory, sortBy, selection]);

  const toggle = (groupId: string, value: string) =>
    setSelection((prev) => toggleInSelection(prev, groupId, value));

  // Built from what the chosen category leaves, so the numbers describe the
  // shelf being looked at rather than the whole catalogue.
  const inCategory = useMemo(
    () =>
      activeCategory === 'All'
        ? products
        : products.filter((p) => {
            const cat = (typeof p.category === 'string' ? p.category : p.category?.name) || '';
            return cat === activeCategory;
          }),
    [products, activeCategory],
  );

  const groups: FilterGroup[] = useMemo(
    () => buildFilterGroups(inCategory, selection),
    [inCategory, selection],
  );

  const activeCount = countSelected(selection);

  // Split for display only — filtering and sorting still run over everything,
  // so a search that matches a sold-out size still finds it.
  const inStock = filteredProducts.filter((p) => !isSoldOut(p));
  const soldOut = filteredProducts.filter((p) => isSoldOut(p));

  const handleSubscribe = (product: any) => {
    if (!user) { setIsAuthOpen(true); return; }
    setSubscrProduct(product);
    setIsSubscrOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[var(--ivory)]">
        {/* Page Header */}
        <div className="bg-white border-b border-[var(--line)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="font-serif font-light text-3xl md:text-4xl text-[var(--ink)] mb-2">Our Products</h1>
            <p className="text-sm text-[var(--ink-soft)]">
              Ethically sourced, lab-verified organic products delivered fresh to your doorstep.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-white border border-[var(--line)] pl-10 pr-4 py-2.5 rounded-sm text-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)] transition"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {groups.length > 0 && (
                <FilterButton onClick={() => setFiltersOpen(true)} count={activeCount} />
              )}

              {/* Category Chips */}
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${
                      activeCategory === cat
                        ? 'bg-[var(--forest)] text-white border-[var(--forest)]'
                        : 'bg-white text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--forest)] hover:text-[var(--forest)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-[var(--line)] px-3 py-2 rounded-sm text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--forest)]"
              >
                {SORT_OPTIONS.filter(opt => ENABLE_PRODUCT_RATINGS || opt.value !== 'rating').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* What is applied stays on the page. The drawer hides the choosing,
              which is the price of a drawer; it must not also hide the state. */}
          {activeCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {Object.entries(selection).flatMap(([groupId, values]) =>
                values.map((value) => (
                  <button
                    key={`${groupId}:${value}`}
                    onClick={() => toggle(groupId, value)}
                    data-testid="applied-filter"
                    className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--forest-rgb)/0.1)] px-3 py-1.5 text-[12px] font-semibold text-[var(--forest)] transition hover:bg-[rgb(var(--forest-rgb)/0.2)]"
                  >
                    {filterChipLabel(groupId, value)}
                    <X className="h-3 w-3" />
                  </button>
                )),
              )}
              <span className="ml-auto text-[12px] text-[var(--ink-soft)]">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              </span>
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm font-bold text-[var(--ink-soft)]">No products found matching your criteria.</p>
            </div>
          ) : (
            <>
              {/* Sold-out sizes are shown, but below the shelf rather than
                  scattered through it. Hiding them entirely would leave a
                  regular wondering whether we had stopped making their size;
                  mixing them in wastes the attention of everyone else. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                {inStock.map((product) => (
                  <ProductCard
                    headingLevel="h2" key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onSubscribe={handleSubscribe}
                  />
                ))}
              </div>

              {soldOut.length > 0 && (
                <section className="mt-14">
                  <h2 className="font-serif font-normal text-lg text-[var(--ink)] mb-1">
                    Currently out of stock
                  </h2>
                  <p className="text-xs text-[var(--ink-soft)] mb-5">
                    Back as soon as the next batch is churned.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                    {soldOut.map((product) => (
                      <ProductCard
                        headingLevel="h2" key={product.id}
                        product={product}
                        onAddToCart={addToCart}
                        onSubscribe={handleSubscribe}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <FilterDrawer

        open={filtersOpen}

        onClose={() => setFiltersOpen(false)}

        groups={groups}

        selection={selection}

        onToggle={toggle}

        onClearAll={() => setSelection({})}

        resultCount={filteredProducts.length}

      />


      <Footer />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SubscriptionModal isOpen={isSubscrOpen} onClose={() => { setIsSubscrOpen(false); setSubscrProduct(null); }} product={subscrProduct} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
