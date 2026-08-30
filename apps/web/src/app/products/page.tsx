import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';
import { fetchLiveProducts } from '../../lib/catalogue';

export const metadata: Metadata = {
  title: 'Our Products',
  description:
    'Every size of every ghee and cold-pressed oil we make, each with its own batch lab report.',
  alternates: { canonical: '/products' },
};

/**
 * The server half of the shop.
 *
 * Its job is to put the cards — and with them a link to every product — in the
 * first response. Until now this page rendered its grid after hydration, so a
 * crawler that does not run JavaScript could reach the shop and find nothing
 * to follow.
 */
export default async function ProductsPage() {
  const initialProducts = await fetchLiveProducts();
  return <ProductsClient initialProducts={initialProducts} />;
}
