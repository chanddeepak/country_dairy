import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found',
  // A 404 has nothing to rank for, and indexing it would put a dead end in
  // search results.
  robots: { index: false, follow: true },
};

/*
 * Deliberately standalone — no Navbar.
 *
 * Navbar requires onCartOpen and onAuthOpen handlers and reads the cart and
 * session contexts, all of which belong to a client component. Pulling that in
 * would make the 404 page depend on the app shell it exists to escape, so this
 * carries its own way out instead.
 */
export default function NotFound() {
  return (
    <main
      data-testid="not-found"
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--ivory)] px-6 py-20 text-center text-[var(--ink)]"
    >
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brass)]">
        404
      </p>

      <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight text-balance sm:text-5xl">
        This page has gone off the pasture
      </h1>

      <p className="mt-4 max-w-md font-sans text-[var(--ink-soft)]">
        The link may be old, or the page may have moved. The shelves are all
        still here.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/products"
          className="rounded-sm bg-[var(--forest)] px-8 py-3.5 font-sans text-sm font-bold text-white transition hover:opacity-90"
        >
          Browse everything
        </Link>
        <Link
          href="/"
          className="rounded-sm border-2 border-[var(--forest)] px-8 py-3.5 font-sans text-sm font-bold text-[var(--forest)] transition hover:bg-[var(--forest)] hover:text-white"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
