import { API_URL } from './constants';

/**
 * Live catalogue rows, fetched on the server.
 *
 * Never cached. These rows carry price and stock, and they decide whether a
 * card renders as buyable or sold out — the product page learned that the hard
 * way, where a five-minute cache kept a sold-out variant on sale for five
 * minutes. A listing is no different.
 *
 * Returns null rather than throwing, so an unreachable API leaves the client
 * to fall back to its own fetch instead of taking the page down.
 */
export async function fetchLiveProducts(categorySlug?: string): Promise<any[] | null> {
  const query = categorySlug
    ? `categorySlug=${encodeURIComponent(categorySlug)}`
    : 'status=LIVE';

  try {
    const res = await fetch(`${API_URL}/catalog/products?${query}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

/** The shelves in the nav, for a category listing's own header and chips. */
export async function fetchNavShelves(): Promise<any[] | null> {
  try {
    // A category name changes monthly at most.
    const res = await fetch(`${API_URL}/catalog/categories/nav`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}
