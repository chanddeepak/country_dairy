import type { MetadataRoute } from 'next';
import { API_URL, SITE_URL } from '../lib/constants';

interface Listed {
  slug: string;
  updatedAt?: string;
}

/**
 * Fetch a list of things with slugs, and never take the build down doing it.
 *
 * A sitemap is a hint, not a contract: an incomplete one costs some crawl
 * efficiency, while a thrown error costs the whole deploy. So an unreachable
 * API returns an empty list and the static routes below still ship.
 */
async function slugsFrom(path: string): Promise<Listed[]> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    const rows = Array.isArray(body) ? body : [];
    return rows.filter(
      (r): r is Listed => typeof (r as Listed)?.slug === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Only what a stranger can open.
 *
 * /account, /checkout and /orders need a session, and /purity/[batch] is
 * reached from a jar rather than from search, so none of them belong in a list
 * addressed to crawlers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    slugsFrom('/catalog/products?status=LIVE'),
    slugsFrom('/catalog/categories/nav'),
  ]);

  const now = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    // Rarely change, and the pages a gateway or a cautious customer goes
    // looking for, so they belong in the index rather than only in the footer.
    ...(['/faq', '/shipping-and-returns', '/privacy', '/terms'] as const).map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    ...categories.map((c) => ({
      url: `${SITE_URL}/category/${c.slug}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
