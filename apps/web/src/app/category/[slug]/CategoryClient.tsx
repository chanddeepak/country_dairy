'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';
import { API_URL } from '../../../lib/constants';
import { mapApiProducts, expandAllVariants, isSoldOut } from '../../../lib/mapProduct';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import ProductCard from '../../../components/product/ProductCard';
import AuthModal from '../../../components/modals/AuthModal';
import CartDrawer from '../../../components/cart/CartDrawer';
import { useApp } from '../../../context/AppContext';
import FilterDrawer, {
  FilterButton,
  countSelected,
  type FilterGroup,
  type Selection,
} from '../../../components/product/FilterDrawer';
import {
  buildFilterGroups,
  filterChipLabel,
  matchesSelection,
  toggleInSelection,
} from '../../../lib/productFilters';
import type { NavCategory } from '../../../lib/useNavTree';
import { notFound, useParams } from 'next/navigation';

// Deliberately the same types the bar uses. A second copy had already drifted:
// it omitted iconName, which the API has sent since the tree existed.
type NavShelf = NavCategory;

/**
 * A shelf, and the kinds of thing on it.
 *
 * A real route rather than /products?category=…, so it has its own address to
 * share or advertise, and somewhere for the category's own description to
 * appear — a column that has existed since the schema was written and has
 * never been shown to anyone.
 */
export default function CategoryClient({
  initialShelf,
  initialProducts,
}: {
  /** Both fetched on the server, so the shelf and its cards ship in the HTML. */
  initialShelf: NavShelf | null;
  initialProducts: any[] | null;
}) {
  // useParams, not the params prop: in this version of Next the prop is a
  // promise, and typing it as a plain object type-checks while being undefined
  // at runtime. Every other dynamic route here reads it the same way.
  const params = useParams();
  const slug = String(params?.slug ?? '');

  const { addToCart } = useApp();

  /*
   * Seeded, so the shelf name, its description and a link to every product on
   * it are in the first response rather than appearing after hydration.
   */
  const seededProducts = useMemo(
    () => (initialProducts?.length ? expandAllVariants(mapApiProducts(initialProducts)) : null),
    [initialProducts],
  );
  const seeded = Boolean(initialShelf);

  const [shelf, setShelf] = useState<NavShelf | null>(initialShelf);
  const [products, setProducts] = useState<any[]>(seededProducts ?? []);
  const [selection, setSelection] = useState<Selection>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(!seeded);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [navRes, prodRes] = await Promise.all([
        fetch(`${API_URL}/catalog/categories/nav`),
        fetch(`${API_URL}/catalog/products?categorySlug=${encodeURIComponent(slug)}`),
      ]);

      if (navRes.ok) {
        const tree: NavShelf[] = await navRes.json();
        const match = tree.find((s) => s.slug === slug);
        // Recorded as state rather than calling notFound() here: it works by
        // throwing, and a throw inside an async callback escapes React instead
        // of reaching the error boundary that renders the 404. It is raised
        // during render below, which is the only place the throw is caught.
        //
        // Deliberately inside the ok branch: if the API is unreachable we have
        // learned nothing, and 404-ing a real category over a transient failure
        // is worse than rendering it thinly.
        if (!match) setMissing(true);
        setShelf(match ?? null);
      }

      if (prodRes.ok) {
        const live = await prodRes.json();
        // One card per size, as on the shop page — a size someone can buy is a
        // size they should be able to find.
        setProducts(expandAllVariants(mapApiProducts(live)));
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // The server resolved the shelf and its products already.
    if (seeded) return;
    void load();
  }, [load]);

  const toggle = (groupId: string, value: string) =>
    setSelection((prev) => toggleInSelection(prev, groupId, value));

  const groups: FilterGroup[] = useMemo(
    // The shelf's own types are passed in, so a type stocking nothing yet still
    // appears — disabled, saying "Soon" — rather than vanishing from a list of
    // what this shelf sells.
    () => (shelf ? buildFilterGroups(products, selection, shelf.types) : []),
    [shelf, products, selection],
  );

  const shown = useMemo(
    () => products.filter((p) => matchesSelection(p, selection)),
    [products, selection],
  );

  const activeCount = countSelected(selection);

  if (missing) notFound();

  const inStock = shown.filter((p) => !isSoldOut(p));
  const soldOut = shown.filter((p) => isSoldOut(p));

  return (
    <div className="flex flex-col min-h-screen bg-[var(--ivory)]">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main id="main" tabIndex={-1} className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {shelf ? (
          <>
            <nav className="flex items-center gap-1 text-xs text-[var(--ink-soft)] mb-4">
              <Link href="/" className="hover:text-[var(--forest)]">Home</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="font-bold text-[var(--ink)]">{shelf.name}</span>
            </nav>

            <h1 className="font-serif font-light text-3xl text-[var(--ink)] mb-1">{shelf.name}</h1>
            <p className="text-sm text-[var(--ink-soft)] max-w-2xl mb-6">
              {shelf.description || `Everything we make in ${shelf.name.toLowerCase()}.`}
            </p>
          </>
        ) : (
          // Placeholders, not the slug. Falling back to it printed a bare
          // lowercase "ghee" in the display serif for as long as the request
          // took — the URL is a machine-readable string, not a page title.
          <div className="animate-pulse mb-6">
            <div className="h-3 w-40 rounded-full bg-[var(--sand)] mb-5" />
            <div className="h-8 w-56 rounded-sm bg-[var(--sand)] mb-3" />
            <div className="h-3 w-80 max-w-full rounded-full bg-[var(--sand)]" />
          </div>
        )}

        {/* Choosing is behind a button; what is chosen is not. A drawer hides
            filters, and hidden filters get used less — so whatever is applied
            stays on the page as removable chips, and only the picking costs a
            click. */}
        {groups.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-4">
            <FilterButton onClick={() => setFiltersOpen(true)} count={activeCount} />

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
              {shown.length} {shown.length === 1 ? 'product' : 'products'}
            </span>
          </div>
        )}

        <div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-white border border-[var(--line)] rounded-sm h-72" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="bg-white border border-[var(--line)] rounded-sm py-16 text-center">
                <p className="text-sm font-bold text-[var(--ink)]">
                  We&apos;re churning it. Coming soon.
                </p>
                <p className="text-xs text-[var(--ink-soft)] mt-1 mb-5">
                  Nothing here just yet — but there is plenty elsewhere.
                </p>
                <Link
                  href="/products"
                  className="inline-block bg-[var(--forest)] hover:bg-[var(--pine)] text-white text-xs font-bold px-5 py-2.5 rounded-sm transition"
                >
                  See everything
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inStock.map((product) => (
                    <ProductCard headingLevel="h2" key={product.id} product={product} onAddToCart={addToCart} />
                  ))}
                </div>

                {soldOut.length > 0 && (
                  <section className="mt-12">
                    <h2 className="font-serif font-normal text-lg text-[var(--ink)] mb-1">
                      Currently out of stock
                    </h2>
                    <p className="text-xs text-[var(--ink-soft)] mb-4">
                      Back as soon as the next batch is churned.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {soldOut.map((product) => (
                        <ProductCard headingLevel="h2" key={product.id} product={product} onAddToCart={addToCart} />
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
        resultCount={shown.length}
      />

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </div>
  );
}
