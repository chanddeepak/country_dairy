'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useNavTree } from '../../lib/useNavTree';

/**
 * The category bar.
 *
 * Flat, the way Two Brothers and Anveshan both have it: a few categories
 * promoted to the bar itself, everything else behind one "Shop by category"
 * menu, then "Shop all". Their catalogues are far larger than ours and neither
 * nests here, so nothing about our size argues for a tree.
 *
 * Which categories are promoted is `showInNav` — a merchandising decision made
 * in the console, not a structural one, so no code changes when the shop's
 * emphasis does.
 *
 * Categories with nothing in them still appear. An empty shelf is a promise
 * that the thing is coming, and its page says so rather than showing a bare
 * grid.
 */
export default function CategoryBar() {
  const pathname = usePathname();
  const tree = useNavTree();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on a click anywhere else, and on Escape — the two ways anyone expects
  // to dismiss a menu they opened by accident.
  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Route changes close it too, or the menu outlives the page it was opened on.
  useEffect(() => setOpen(false), [pathname]);

  // Nothing to show is not an empty bar — it is no bar. A strip of chrome with
  // one link in it looks broken in a way that no link at all does not.
  if (tree.length === 0) return null;

  const promoted = tree.filter((c) => c.showInNav);
  const rest = tree.filter((c) => !c.showInNav);
  const active = (slug: string) => pathname === `/category/${slug}`;

  return (
    <div className="hidden md:block bg-[#3A6038] text-white border-b border-black/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 h-11 text-[13px] font-semibold">
          {promoted.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              data-testid="category-bar-link"
              className={`px-3 py-1.5 rounded-lg transition hover:bg-white/15 ${
                active(cat.slug) ? 'bg-white/20' : ''
              }`}
            >
              {cat.name}
            </Link>
          ))}

          {rest.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                data-testid="category-bar-more"
                aria-expanded={open}
                aria-haspopup="true"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg transition hover:bg-white/15"
              >
                Shop by category
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open && (
                <div className="absolute left-0 top-full mt-1 w-60 bg-white text-[#2A2A2A] rounded-xl shadow-xl border border-stone-200 py-1.5 z-50">
                  {rest.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/category/${cat.slug}`}
                      data-testid="category-bar-link"
                      className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-stone-50 transition"
                    >
                      <span>{cat.name}</span>
                      {/* Only when there is something there. A "(0)" beside a
                          category reads as a fault rather than as news. */}
                      {cat.productCount > 0 && (
                        <span className="text-[11px] font-normal text-[#6b6661]">
                          {cat.productCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link
            href="/products"
            className="ml-auto px-3 py-1.5 rounded-lg transition hover:bg-white/15"
          >
            Shop all
          </Link>
        </div>
      </div>
    </div>
  );
}
