import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_URL } from '../../../lib/constants';

interface NavShelf {
  name: string;
  slug: string;
  description: string | null;
}

/**
 * Resolve one shelf from the nav tree.
 *
 * Called twice per render — once for the metadata, once for the body. Both use
 * the same URL and the same cache options, so Next serves the second from the
 * first; this is one request, not two.
 *
 * Returns undefined for "no such category" and null for "could not tell",
 * because the two must not be treated alike: the first is a 404, the second is
 * the API being unreachable, and 404-ing a real category because a fetch failed
 * would quietly delete pages from search results.
 */
async function findShelf(slug: string): Promise<NavShelf | undefined | null> {
  try {
    // A category name changes monthly at most, and metadata generation should
    // never be what makes a page slow to serve.
    const res = await fetch(`${API_URL}/catalog/categories/nav`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const tree: NavShelf[] = await res.json();
    return tree.find((s) => s.slug === slug);
  } catch {
    return null;
  }
}

/**
 * The title and description for a category.
 *
 * The page itself is a client component — it has checkboxes, a cart drawer and
 * an auth modal — and a client component cannot export metadata. A layout can,
 * so the two live side by side: this decides what search engines and a shared
 * link see, the page decides what the customer does.
 *
 * Giving each shelf its own title is one of the reasons this is a real route
 * rather than /products?category=…, so it is worth the extra file.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shelf = await findShelf(slug);
  if (!shelf) return {};

  const description =
    shelf.description || `Shop ${shelf.name.toLowerCase()} from Country Dairy.`;

  return {
    title: `${shelf.name} | Country Dairy`,
    description,
    openGraph: { title: `${shelf.name} | Country Dairy`, description },
  };
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shelf = await findShelf(slug);

  // Deliberately here rather than in the page. The page is a client component,
  // so its notFound() runs after hydration: the customer sees the 404 screen
  // but the response was already sent as 200, and a crawler records a real page
  // at a URL that does not exist. Raising it here makes the status a true 404.
  //
  // `undefined` only — a null means the lookup failed, and an unreachable API
  // must not take down every category page with it.
  if (shelf === undefined) notFound();

  return children;
}
