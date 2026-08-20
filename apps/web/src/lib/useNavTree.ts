'use client';

import { useEffect, useState } from 'react';
import { API_URL } from './constants';

export interface NavCategoryType {
  id: string;
  name: string;
  slug: string;
  /** A Lucide icon name, set in the console. See lib/categoryIcon. */
  iconName: string | null;
  productCount: number;
}

export interface NavCategory extends NavCategoryType {
  showInNav: boolean;
  description: string | null;
  types: NavCategoryType[];
}

/**
 * Fetched once per browser session, not once per page.
 *
 * The category bar renders inside Navbar, which every page mounts for itself,
 * so without this the tree would be re-fetched on every client navigation and
 * the bar would flicker its way through the site. The promise is cached rather
 * than the result, so the bar and the mobile menu mounting together share one
 * request instead of racing.
 *
 * A page reload clears it, which is about the right refresh interval for
 * something that changes when someone adds a category.
 */
let treePromise: Promise<NavCategory[]> | null = null;

/**
 * The resolved value, kept beside the promise.
 *
 * Awaiting an already-settled promise still costs a microtask, so a hook that
 * always starts at `loading` renders the placeholder for one frame on every
 * client-side navigation — a skeleton flashing across a bar whose contents have
 * been in memory since the first page. Reading the value synchronously skips
 * that entirely.
 *
 * Only ever written from the effect below, which does not run on the server, so
 * this stays null during SSR and the markup React hydrates against matches.
 */
let cachedTree: NavCategory[] | null = null;

function loadTree(): Promise<NavCategory[]> {
  if (!treePromise) {
    treePromise = fetch(`${API_URL}/catalog/categories/nav`)
      .then((res) => (res.ok ? res.json() : []))
      .then((t: NavCategory[]) => {
        cachedTree = t;
        return t;
      })
      .catch(() => {
        // Let the next mount try again — a failed lookup describes the network
        // this second, not the catalogue.
        treePromise = null;
        return [];
      });
  }
  return treePromise;
}

export interface NavTreeState {
  tree: NavCategory[];
  /** True until the first fetch settles, however it settles. */
  loading: boolean;
}

/**
 * The shelves, for anything that needs to offer them as navigation.
 *
 * `loading` is reported separately because an empty tree means two different
 * things: still fetching, which deserves a placeholder holding the right amount
 * of space, and genuinely no categories, which deserves nothing at all.
 * Collapsing the two makes the bar appear out of nowhere once the request lands
 * and shove the page down by its own height.
 */
export function useNavTree(): NavTreeState {
  const [tree, setTree] = useState<NavCategory[]>(cachedTree ?? []);
  const [loading, setLoading] = useState(cachedTree === null);

  useEffect(() => {
    if (cachedTree) return;

    let alive = true;
    void loadTree().then((t) => {
      if (!alive) return;
      setTree(t);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { tree, loading };
}
