'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { API_URL } from '../../../lib/constants';
import { mapApiProducts, expandAllVariants, isSoldOut } from '../../../lib/mapProduct';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import ProductCard from '../../../components/product/ProductCard';
import AuthModal from '../../../components/modals/AuthModal';
import CartDrawer from '../../../components/cart/CartDrawer';
import { useApp } from '../../../context/AppContext';
import { notFound, useParams, useRouter } from 'next/navigation';

interface NavType {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface NavShelf extends NavType {
  showInNav: boolean;
  description: string | null;
  types: NavType[];
}

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
        <nav className="flex items-center gap-1 text-xs text-[#6b6661] mb-4">
          <Link href="/" className="hover:text-[#3A6038]">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-bold text-[#2A2A2A]">{shelf?.name ?? slug}</span>
        </nav>

        <h1 className="font-serif font-black text-3xl text-[#2A2A2A] mb-1">
          {shelf?.name ?? slug}
        </h1>
        {shelf && (
          <p className="text-sm text-[#6b6661] max-w-2xl mb-6">
            {shelf.description || `Everything we make in ${shelf.name.toLowerCase()}.`}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Types, as filters between kinds of the same thing. */}
          {shelf && shelf.types.length > 0 && (
            <aside className="bg-white border border-stone-200 rounded-xl p-4 h-fit">
              <h2 className="text-sm font-bold text-[#3A6038]">Type</h2>
              <p className="text-[11px] text-[#6b6661] mb-3">Tick more than one</p>

              {shelf.types.map((type) => {
                const count = countsByType.get(type.name) ?? 0;
                const none = count === 0;
                return (
                  <label
                    key={type.id}
                    className={`flex items-center gap-2.5 py-2 border-b border-dashed border-stone-200 last:border-0 text-sm ${
                      none ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      data-testid="type-filter"
                      disabled={none}
                      checked={checked.includes(type.name)}
                      onChange={() => toggle(type.name)}
                      className="accent-[#3A6038]"
                    />
                    <span className="flex-1">{type.name}</span>
                    {/* A kind we do not stock yet is shown, greyed, rather than
                        hidden: it says the thing is coming. It cannot be
                        ticked, so it can never produce an empty grid. */}
                    <span className="text-[11px] text-[#6b6661]">({count})</span>
                  </label>
                );
              })}
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
