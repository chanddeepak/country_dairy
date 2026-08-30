import CategoryClient from './CategoryClient';
import { fetchLiveProducts, fetchNavShelves } from '../../../lib/catalogue';

/**
 * The server half of a category listing.
 *
 * The layout beside this one has already 404'd a slug nobody has, so by the
 * time this runs the shelf either exists or the API is unreachable — and in
 * the second case the client half still has its own fetch to fall back on.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [shelves, initialProducts] = await Promise.all([
    fetchNavShelves(),
    fetchLiveProducts(slug),
  ]);

  const initialShelf = shelves?.find((s) => s.slug === slug) ?? null;

  return <CategoryClient initialShelf={initialShelf} initialProducts={initialProducts} />;
}
