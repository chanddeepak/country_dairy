'use client';

import { useEffect, useRef } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { categoryIcon } from '../../lib/categoryIcon';

export interface FilterOption {
  /** Stable value used in state. Not necessarily what is displayed. */
  value: string;
  label: string;
  count: number;
  /** A Lucide name, where the option has one. Types do; sizes do not. */
  iconName?: string | null;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

/** Which options are ticked, per group. */
export type Selection = Record<string, string[]>;

export function countSelected(selection: Selection): number {
  return Object.values(selection).reduce((n, values) => n + values.length, 0);
}

/**
 * The filter panel.
 *
 * Deliberately generic over a list of groups rather than knowing about types:
 * the reason for choosing a drawer over an inline control was that size, price
 * and availability are coming, and each one should be a few lines of data
 * rather than another piece of layout.
 *
 * The trade-off that comes with a drawer is that filters are hidden until
 * asked for, and hidden filters get used less. The page compensates by showing
 * whatever is applied as removable chips beside the button, so the state is
 * never invisible — only the choosing is behind a click.
 */
export default function FilterDrawer({
  open,
  onClose,
  groups,
  selection,
  onToggle,
  onClearAll,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  groups: FilterGroup[];
  selection: Selection;
  onToggle: (groupId: string, value: string) => void;
  onClearAll: () => void;
  resultCount: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember what opened it, so closing returns the keyboard where it was
    // rather than dumping focus at the top of the document.
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll under the panel.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  const total = countSelected(selection);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-[rgb(var(--ink-rgb)/0.55)] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/*
        A div, not an <aside>. The element already carries role="dialog", and
        aside has an implicit complementary role that the explicit one is not
        allowed to override — axe reports it as an ARIA role on an incompatible
        element. Nothing about the drawer changes; the wrapper stops making two
        contradictory claims about what it is.
      */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        data-testid="filter-drawer"
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(21rem,90vw)] flex-col bg-white shadow-2xl outline-none transition-transform duration-250 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--forest)]">
            Filters
          </h2>
          <button
            onClick={onClose}
            data-testid="filter-close"
            aria-label="Close filters"
            className="rounded-sm p-1.5 text-[var(--ink-soft)] transition hover:bg-[var(--ivory)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {groups.map((group) => (
            <section
              key={group.id}
              className="border-b border-[var(--line)] py-4 last:border-0"
            >
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                {group.label}
              </h3>

              {group.options.map((option) => {
                const on = (selection[group.id] ?? []).includes(option.value);
                // Nothing behind it means ticking it can only empty the grid.
                const empty = option.count === 0;
                const Icon = option.iconName ? categoryIcon(option.iconName) : null;

                return (
                  <label
                    key={option.value}
                    className={`relative flex items-center gap-3 py-2 ${
                      empty ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      data-testid={`filter-${group.id}`}
                      data-value={option.value}
                      disabled={empty}
                      checked={on}
                      onChange={() => onToggle(group.id, option.value)}
                      // Transparent and full-size rather than sr-only: a
                      // clipped 1px input is one Playwright treats as hidden and
                      // refuses to check, and this makes the whole row the hit
                      // target anyway.
                      className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <span
                      aria-hidden="true"
                      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm border transition peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--forest-rgb)/0.4)] ${
                        on ? 'border-[var(--forest)] bg-[var(--forest)] text-white' : 'border-[var(--line)]'
                      }`}
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>

                    {Icon && <Icon className="h-4 w-4 shrink-0 text-[var(--ink-soft)]" strokeWidth={1.75} />}

                    <span
                      className={`flex-1 text-[13px] ${
                        on ? 'font-bold text-[var(--forest)]' : 'font-medium text-[var(--ink)]'
                      }`}
                    >
                      {option.label}
                    </span>

                    {/* A kind we do not stock yet says so in words. "0" beside a
                        name reads as a fault; the word reads as news. */}
                    <span className="text-[11px] tabular-nums text-[var(--ink-soft)]">
                      {empty ? 'Soon' : option.count}
                    </span>
                  </label>
                );
              })}
            </section>
          ))}
        </div>

        <footer className="flex items-center gap-3 border-t border-[var(--line)] px-5 py-4">
          <button
            onClick={onClearAll}
            disabled={total === 0}
            className="text-[12px] font-semibold text-[var(--ink-soft)] transition hover:text-[var(--forest)] disabled:opacity-40 disabled:hover:text-[var(--ink-soft)]"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            data-testid="filter-apply"
            className="flex-1 rounded-full bg-[var(--forest)] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[var(--pine)]"
          >
            {/* The number it will show, not "Apply". Filtering is already live
                behind the panel, so this button closes it — and saying what is
                waiting is more use than naming the action. */}
            Show {resultCount} {resultCount === 1 ? 'product' : 'products'}
          </button>
        </footer>
      </div>
    </>
  );
}

/** The button that opens the panel, carrying how many filters are on. */
export function FilterButton({
  onClick,
  count,
}: {
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      data-testid="filter-open"
      aria-haspopup="dialog"
      className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink)] transition hover:border-[var(--forest)] hover:text-[var(--forest)]"
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      Filter
      {count > 0 && (
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--forest)] px-1 text-[10px] text-white">
          {count}
        </span>
      )}
    </button>
  );
}
