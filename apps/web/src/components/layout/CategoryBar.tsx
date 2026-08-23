'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useNavTree, type NavCategory } from '../../lib/useNavTree';
import { categoryIcon } from '../../lib/categoryIcon';
import ContourField from '../ui/ContourField';

/**
 * How wide the row of tiles is, by how many categories there are.
 *
 * An explicit width, because the panel is absolutely positioned and so sizes
 * shrink-to-fit: the browser resolves that against the *minimum* content width,
 * which for a wrapping flex row is one tile, and every category ends up stacked
 * in a single column. Literal classes because Tailwind generates what it can
 * see in the source — an interpolated `w-[${n}rem]` produces nothing.
 *
 * A tile is 8rem with a 0.25rem gap, and rows cap at four.
 */
const PANEL_WIDTH: Record<number, string> = {
  0: 'w-[8rem]',
  1: 'w-[8rem]',
  2: 'w-[16.25rem]',
  3: 'w-[24.5rem]',
  4: 'w-[32.75rem]',
};

/** One category in the panel: icon, name, and how much of it there is. */
function PanelTile({ cat, onNavigate }: { cat: NavCategory; onNavigate: () => void }) {
  const Icon = categoryIcon(cat.iconName);
  const empty = cat.productCount === 0;

  return (
    <Link
      href={`/category/${cat.slug}`}
      data-testid="category-bar-link"
      onClick={onNavigate}
      className="group flex w-32 flex-col items-center gap-2 rounded-sm px-2 py-4 transition hover:bg-[var(--cream)]"
    >
      <span
        className={`grid h-14 w-14 place-items-center rounded-full transition ${
          empty
            ? 'bg-[var(--cream)] text-[var(--ink-soft)]'
            : 'bg-[var(--forest)]/10 text-[var(--forest)] group-hover:bg-[var(--forest)] group-hover:text-[var(--ivory)]'
        }`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </span>

      <span className="text-center text-[12px] font-bold leading-tight text-[var(--ink)]">
        {cat.name}
      </span>

      {/* "Coming soon" rather than "0 products". A zero beside a category reads
          as a fault; the words read as news. */}
      <span className="text-[10px] font-medium text-[var(--ink-soft)]">
        {empty
          ? 'Coming soon'
          : `${cat.productCount} ${cat.productCount === 1 ? 'product' : 'products'}`}
      </span>
    </Link>
  );
}

/**
 * The bar's own shape, while the tree is on its way.
 *
 * It holds exactly the height of the real thing. Returning nothing until the
 * request lands means the bar appears from nowhere and pushes the page down by
 * 56px underneath whoever is already reading it — the placeholder costs the
 * same space, so nothing moves when the real links arrive.
 */
function BarSkeleton() {
  return (
    <div
      data-testid="category-bar-skeleton"
      className="hidden border-b border-[var(--line)] bg-[var(--ivory)] md:block"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 animate-pulse items-center justify-center gap-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <span className="h-8 w-8 rounded-full bg-[var(--line)]" />
              <span className="h-2.5 w-16 rounded-full bg-[var(--line)]" />
            </div>
          ))}
          <span className="mx-2 h-5 w-px bg-[var(--line)]" />
          <span className="h-7 w-24 rounded-full bg-[var(--line)]" />
        </div>
      </div>
    </div>
  );
}

/**
 * The category bar.
 *
 * Flat, the way Two Brothers and Anveshan both have it: a few categories
 * promoted to the bar itself, the rest behind one "Shop by category" panel,
 * then "Shop all". Their catalogues are far larger than ours and neither nests
 * here, so nothing about our size argues for a tree.
 *
 * Which categories are promoted is `showInNav` — a merchandising decision made
 * in the console, not a structural one, so no code changes when the shop's
 * emphasis does. The icons come from `Category.iconName` for the same reason.
 *
 * It sits on white with hairline rules rather than in a block of colour. A
 * solid green band competes with both the header above it and the product
 * photography below, and it was the single thing making this look like system
 * chrome instead of a shop.
 */
export default function CategoryBar() {
  const pathname = usePathname();
  const { tree, loading } = useNavTree();
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

  if (loading) return <BarSkeleton />;

  // Nothing to show is not an empty bar — it is no bar. A strip of chrome with
  // one link in it looks broken in a way that no link at all does not. This is
  // reached only once the request has settled, so it means "no categories"
  // rather than "not yet".
  if (tree.length === 0) return null;

  const promoted = tree.filter((c) => c.showInNav);
  const rest = tree.filter((c) => !c.showInNav);
  const active = (slug: string) => pathname === `/category/${slug}`;

  return (
    <div
      data-testid="category-bar"
      className="hidden border-b border-[var(--line)] bg-[var(--ivory)] md:block"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Centred as a group. Left-aligned links with the pill pushed to
            the far right leaves a void down the middle of the bar until the
            catalogue is much bigger than it is today. */}
        <div className="flex h-14 items-center justify-center gap-1">
          {promoted.map((cat) => {
            const Icon = categoryIcon(cat.iconName);
            const on = active(cat.slug);

            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                data-testid="category-bar-link"
                aria-current={on ? 'page' : undefined}
                className="group relative flex items-center gap-2 rounded-sm px-3 py-2 transition hover:bg-[var(--cream)]"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full transition ${
                    on
                      ? 'bg-[var(--forest)] text-[var(--ivory)]'
                      : 'bg-[var(--forest)]/10 text-[var(--forest)] group-hover:bg-[var(--forest)]/20'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>

                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.08em] ${
                    on ? 'text-[var(--forest)]' : 'text-[var(--ink)]'
                  }`}
                >
                  {cat.name}
                </span>

                {/* Gold underline for the shelf you are standing on. A filled
                    pill would put a second heavy shape next to the icon tile. */}
                {on && (
                  <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[var(--brass)]" />
                )}
              </Link>
            );
          })}

          {rest.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                data-testid="category-bar-more"
                aria-expanded={open}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 rounded-sm px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition hover:bg-[var(--cream)] ${
                  open ? 'text-[var(--forest)]' : 'text-[var(--ink)]'
                }`}
              >
                Shop by category
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open && (
                // Centred on the trigger rather than flush to its left edge:
                // the bar itself is centred, and an off-centre panel under a
                // centred bar reads as a mistake.
                <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2">
                  {/* The notch lives outside the clipped box. Inside it, the
                      overflow-hidden that keeps the ridgeline within the rounded
                      corners would cut it in half. */}
                  <span className="absolute left-1/2 top-0 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-[var(--line)] bg-white" />

                  <div className="relative overflow-hidden rounded-sm border border-[var(--line)] bg-white shadow-[0_20px_50px_-12px_rgba(42,42,42,0.25)]">
                    <ContourField tone="forest" opacity={0.5} />

                    <div className="relative z-10 p-4 pb-2">
                      {/* Every category, including the ones already promoted to
                          the bar. A menu called "Shop by category" that omits
                          the category you can see beside it is a puzzle, not a
                          shortcut. */}
                      {/* Flex rather than a grid: the panel hugs its content,
                          and fixed-width tiles inside auto-sized grid columns
                          overlap each other. Four per row before it wraps. */}
                      <div
                        className={`flex flex-wrap justify-center gap-1 ${
                          PANEL_WIDTH[Math.min(tree.length, 4)]
                        }`}
                      >
                        {tree.map((cat) => (
                          <PanelTile key={cat.id} cat={cat} onNavigate={() => setOpen(false)} />
                        ))}
                      </div>

                      <div className="flex justify-center pb-8 pt-4">
                        <Link
                          href="/products"
                          onClick={() => setOpen(false)}
                          className="whitespace-nowrap rounded-full bg-[var(--forest)] px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[var(--pine)]"
                        >
                          Shop all products
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <span className="mx-2 h-5 w-px bg-[var(--line)]" aria-hidden="true" />

          <Link
            href="/products"
            className="rounded-full border border-[var(--forest)]/30 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--forest)] transition hover:border-[var(--forest)] hover:bg-[var(--forest)] hover:text-[var(--ivory)]"
          >
            Shop all
          </Link>
        </div>
      </div>
    </div>
  );
}
