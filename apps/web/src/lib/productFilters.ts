import { isSoldOut } from './mapProduct';
import type { FilterGroup, Selection } from '../components/product/FilterDrawer';

/**
 * How a card answers each filter.
 *
 * All three read the card actually on screen. The grid shows one card per size,
 * so the size of a card is the size of the variant it is showing — not the
 * product's whole range, which would make every jar match every size.
 */
export const FACETS = {
  type: (p: any): string => p.productType ?? '',
  size: (p: any): string =>
    (p.variants ?? []).find((v: any) => v.isDefault)?.volumeOrWeight ??
    (p.variants ?? [])[0]?.volumeOrWeight ??
    '',
  availability: (p: any): string => (isSoldOut(p) ? 'out' : 'in'),
} as const;

export type FacetId = keyof typeof FACETS;

/**
 * Whether a card survives the current selection.
 *
 * `skip` leaves one group out, which is how each group's counts are worked out:
 * a number beside an option should say what ticking it would leave given
 * everything else already ticked, not what it would leave on its own.
 */
export function matchesSelection(p: any, selection: Selection, skip?: string): boolean {
  return Object.entries(selection).every(([groupId, values]) => {
    if (groupId === skip || values.length === 0) return true;
    const read = FACETS[groupId as FacetId];
    return read ? values.includes(read(p)) : true;
  });
}

/** Toggle one value within one group, dropping the key when it empties. */
export function toggleInSelection(selection: Selection, groupId: string, value: string): Selection {
  const current = selection[groupId] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];

  // Drop the key rather than leaving an empty array behind, so "is anything
  // filtered" stays a simple question everywhere it is asked.
  const { [groupId]: _drop, ...rest } = selection;
  return next.length ? { ...rest, [groupId]: next } : rest;
}

export interface TypeOption {
  name: string;
  iconName?: string | null;
}

/**
 * The filter groups a set of products supports.
 *
 * Everything is derived from the products themselves, so a new size or a newly
 * emptied shelf needs no configuration anywhere. `knownTypes` exists for the
 * category page, which wants to list a type it stocks nothing of yet — that one
 * shows disabled rather than vanishing, because it tells a customer the thing is
 * coming.
 */
export function buildFilterGroups(
  products: any[],
  selection: Selection,
  knownTypes?: TypeOption[],
): FilterGroup[] {
  const countIn = (groupId: FacetId, value: string) =>
    products.filter(
      (p) => FACETS[groupId](p) === value && matchesSelection(p, selection, groupId),
    ).length;

  const groups: FilterGroup[] = [];

  const types: TypeOption[] =
    knownTypes ??
    Array.from(new Set(products.map(FACETS.type).filter(Boolean))).map((name) => ({ name }));

  // One type is not a choice — it filters everything down to everything.
  if (types.length > 1 || (knownTypes && knownTypes.length > 0)) {
    groups.push({
      id: 'type',
      label: 'Type',
      options: types.map((t) => ({
        value: t.name,
        label: t.name,
        iconName: t.iconName,
        count: countIn('type', t.name),
      })),
    });
  }

  const sizes = Array.from(new Set(products.map(FACETS.size).filter(Boolean)));
  if (sizes.length > 1) {
    groups.push({
      id: 'size',
      label: 'Size',
      options: sizes.map((size) => ({
        value: size,
        label: size,
        count: countIn('size', size),
      })),
    });
  }

  // Only worth offering once something is actually out of stock.
  if (products.some((p) => isSoldOut(p))) {
    groups.push({
      id: 'availability',
      label: 'Availability',
      options: [{ value: 'in', label: 'In stock', count: countIn('availability', 'in') }],
    });
  }

  return groups;
}

/** What an applied filter is called on its chip. */
export function filterChipLabel(groupId: string, value: string): string {
  if (groupId === 'availability') return value === 'in' ? 'In stock' : 'Out of stock';
  return value;
}
