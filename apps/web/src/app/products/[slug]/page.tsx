import { Suspense } from 'react';
import ProductDetailClient from './ProductDetailClient';
import { getProduct } from './getProduct';

/**
 * The server half of the product page.
 *
 * It exists to put the product in the first response. The page below is still
 * a client component — gallery, variant picker, quantity, cart drawer — but it
 * now receives the product as a prop instead of fetching it after hydration,
 * so the title, price, description and image are in the HTML.
 *
 * Suspense because the client half reads useSearchParams for ?variant=.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The layout has already 404'd an unknown slug; a null here is the API being
  // unreachable, and the client half still has its own fetch to fall back on.
  const product = await getProduct(slug);

  return (
    <Suspense fallback={null}>
      <ProductDetailClient initialProduct={product ?? null} />
    </Suspense>
  );
}
