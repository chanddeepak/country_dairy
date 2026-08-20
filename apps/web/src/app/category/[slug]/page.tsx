'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { API_URL } from '../../../lib/constants';
import { mapApiProducts, expandAllVariants, isSoldOut } from '../../../lib/mapProduct';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import ProductCard from '../../../components/product/ProductCard';
import AuthModal from '../../../components/modals/AuthModal';
import CartDrawer from '../../../components/cart/CartDrawer';
import { useApp } from '../../../context/AppContext';
import { categoryIcon } from '../../../lib/categoryIcon';
import type { NavCategory } from '../../../lib/useNavTree';
import { notFound, useParams, useRouter } from 'next/navigation';

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
export default function CategoryPage() {
  // useParams, not the params prop: in this version of Next the prop is a
  // promise, and typing it as a plain object type-checks while being undefined
  // at runtime. Every other dynamic route here reads it the same way.
  const params = useParams();
  const slug = String(params?.slug ?? '');

  const { addToCart } = useApp();
  const router = useRouter();

  const [shelf, setShelf] = useState<NavShelf | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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
    void load();
  }, [load]);

  const toggle = (name: string) =>
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    );

  // Counts are derived from the very array that fills the grid, never from the
  // API's own product count. The grid shows one card per size, so a shelf
  // holding one product in two jars is two cards — a sidebar reading "(1)"
  // beside two results is worse than no number at all.
  const countsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const type = (p as { productType?: string }).productType;
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  // Nothing ticked means everything, which is what a customer expects from a
  // set of checkboxes they have not touched.
  const shown = useMemo(
    () =>
      checked.length === 0
        ? products
        : products.filter((p) => checked.includes((p as { productType?: string }).productType ?? '')),
    [products, checked],
  );

  if (missing) notFound();

  const inStock = shown.filter((p) => !isSoldOut(p));
  const soldOut = shown.filter((p) => isSoldOut(p));

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F3]">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {shelf ? (
          <>
            <nav className="flex items-center gap-1 text-xs text-[#6b6661] mb-4">
              <Link href="/" className="hover:text-[#3A6038]">Home</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="font-bold text-[#2A2A2A]">{shelf.name}</span>
            </nav>

            <h1 className="font-serif font-black text-3xl text-[#2A2A2A] mb-1">{shelf.name}</h1>
            <p className="text-sm text-[#6b6661] max-w-2xl mb-6">
              {shelf.description || `Everything we make in ${shelf.name.toLowerCase()}.`}
            </p>
          </>
        ) : (
          // Placeholders, not the slug. Falling back to it printed a bare
          // lowercase "ghee" in the display serif for as long as the request
          // took — the URL is a machine-readable string, not a page title.
          <div className="animate-pulse mb-6">
            <div className="h-3 w-40 rounded-full bg-stone-200 mb-5" />
            <div className="h-8 w-56 rounded-lg bg-stone-200 mb-3" />
            <div className="h-3 w-80 max-w-full rounded-full bg-stone-200" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Types, as filters between kinds of the same thing. */}
          {shelf && shelf.types.length > 0 && (
            <aside className="bg-white border border-stone-200 rounded-2xl p-4 h-fit lg:sticky lg:top-40">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#3A6038]">
                  Type
                </h2>
                {/* Only once there is something to clear. A permanently visible
                    Clear on an untouched filter invites a pointless click. */}
                {checked.length > 0 && (
                  <button
                    onClick={() => setChecked([])}
                    className="text-[11px] font-semibold text-[#6b6661] hover:text-[#3A6038] transition"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Wraps on a phone, stacks on a desktop. A single tall column of
                  one row above the grid wastes the width a phone has. */}
              <div className="flex flex-wrap gap-2 lg:flex-col">
                {shelf.types.map((type) => {
                  const count = countsByType.get(type.name) ?? 0;
                  const none = count === 0;
                  const on = checked.includes(type.name);
                  const Icon = categoryIcon(type.iconName);

                  return (
                    <label
                      key={type.id}
                      className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                        none
                          ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-60'
                          : on
                            ? 'cursor-pointer border-[#3A6038] bg-[#3A6038]/8'
                            : 'cursor-pointer border-stone-200 hover:border-[#3A6038]/40 hover:bg-[#FAF8F3]'
                      }`}
                    >
                      {/* A real checkbox, restyled rather than replaced: it keeps
                          the keyboard and screen-reader behaviour that a div
                          pretending to be one throws away. */}
                      <input
                        type="checkbox"
                        data-testid="type-filter"
                        disabled={none}
                        checked={on}
                        onChange={() => toggle(type.name)}
                        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      />
                      <span
                        aria-hidden="true"
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#3A6038]/40 ${
                          on ? 'bg-[#3A6038] text-white' : 'bg-stone-100 text-[#6b6661]'
                        }`}
                      >
                        {on ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      </span>

                      <span
                        className={`flex-1 text-[13px] font-semibold ${
                          on ? 'text-[#3A6038]' : 'text-[#2A2A2A]'
                        }`}
                      >
                        {type.name}
                      </span>

                      {/* A kind we do not stock yet still shows, so a customer
                          learns it is coming — but it says so in words. "(0)"
                          beside a name reads as a fault. It cannot be ticked,
                          so it can never empty the grid. */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          none
                            ? 'bg-stone-100 text-[#6b6661]'
                            : on
                              ? 'bg-[#3A6038] text-white'
                              : 'bg-stone-100 text-[#6b6661]'
                        }`}
                      >
                        {none ? 'Soon' : count}
                      </span>
                    </label>
                  );
                })}
              </div>
            </aside>
          )}

          <div className={shelf && shelf.types.length > 0 ? '' : 'lg:col-span-2'}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-white border border-stone-200 rounded-xl h-72" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-xl py-16 text-center">
                <p className="text-sm font-bold text-[#2A2A2A]">
                  We&apos;re churning it. Coming soon.
                </p>
                <p className="text-xs text-[#6b6661] mt-1 mb-5">
                  Nothing here just yet — but there is plenty elsewhere.
                </p>
                <Link
                  href="/products"
                  className="inline-block bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition"
                >
                  See everything
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inStock.map((product) => (
                    <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                  ))}
                </div>

                {soldOut.length > 0 && (
                  <section className="mt-12">
                    <h2 className="font-serif font-bold text-lg text-[#2A2A2A] mb-1">
                      Currently out of stock
                    </h2>
                    <p className="text-xs text-[#6b6661] mb-4">
                      Back as soon as the next batch is churned.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {soldOut.map((product) => (
                        <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => router.push('/checkout')}
      />
    </div>
  );
}
