'use client';

import { useEffect, useState } from 'react';
import { API_URL } from './constants';

export interface NavCategoryType {
  id: string;
  name: string;
  slug: string;
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

function loadTree(): Promise<NavCategory[]> {
  if (!treePromise) {
    treePromise = fetch(`${API_URL}/catalog/categories/nav`)
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => {
        // Let the next mount try again — a failed lookup describes the network
        // this second, not the catalogue.
        treePromise = null;
        return [];
      });
  }
  return treePromise;
}

/** The shelves, for anything that needs to offer them as navigation. */
export function useNavTree(): NavCategory[] {
  const [tree, setTree] = useState<NavCategory[]>([]);

  useEffect(() => {
    let alive = true;
    void loadTree().then((t) => {
      if (alive) setTree(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  return tree;
}
