import { useCallback, useEffect, useState } from 'react';
import { fetchProducts, type ApiProduct, type ApiVariant } from '../lib/api';
import { FALLBACK_PRODUCTS, PRODUCT_IMAGES, type Product, type ProductVariant } from '../constants';

/**
 * The catalogue, from the database.
 *
 * The screens were rendering FALLBACK_PRODUCTS — a hardcoded list in the
 * source. The same thing happened on the storefront and took a while to spot,
 * because a shelf full of plausible products looks exactly like a shelf that
 * is working. Prices drift, sizes drift, and nobody notices until a customer
 * is charged last quarter's price.
 *
 * The fallback stays, but demoted: it is what an offline first launch shows
 * instead of an empty screen, and `isStale` says so out loud so a screen can
 * tell the customer rather than quietly lying to them.
 */

/** Maps the API's shape onto the display shape the screens already expect. */
function toDisplayVariant(v: ApiVariant, slug: string): ProductVariant {
  const discount =
    Number(v.mrpPrice) > Number(v.sellingPrice)
      ? `${Math.round((1 - Number(v.sellingPrice) / Number(v.mrpPrice)) * 100)}% OFF`
      : undefined;

  return {
    id: v.id,
    name: v.sizeLabel,
    volumeOrWeight: v.sizeLabel,
    price: v.sellingPrice,
    originalPrice: Number(v.mrpPrice) > Number(v.sellingPrice) ? v.mrpPrice : undefined,
    discountPercent: discount,
    // A remote URL where there is one, else the bundled image for this slug.
    // Bundled art is a stand-in for a missing photograph, not for a product.
    image: v.imageUrl ? { uri: v.imageUrl } : PRODUCT_IMAGES[slug],
  };
}

function toDisplayProduct(p: ApiProduct): Product {
  const variants = (p.variants ?? []).filter((v) => v.isActive);
  const cheapest = variants.reduce<ApiVariant | null>(
    (best, v) => (!best || Number(v.sellingPrice) < Number(best.sellingPrice) ? v : best),
    null,
  );

  const remoteImages = (p.galleryImages ?? [])
    .filter((g) => !g.variantId)
    .map((g) => ({ uri: g.imageUrl }));

  return {
    id: p.id,
    name: p.title,
    slug: p.slug,
    category: p.categoryName ?? '',
    description: p.tagline ?? p.storyDescription ?? '',
    price: cheapest?.sellingPrice ?? '0',
    originalPrice:
      cheapest && Number(cheapest.mrpPrice) > Number(cheapest.sellingPrice)
        ? cheapest.mrpPrice
        : undefined,
    badge: p.badgeText ?? undefined,
    imageUrls: remoteImages.length
      ? remoteImages
      : PRODUCT_IMAGES[p.slug]
        ? [PRODUCT_IMAGES[p.slug]]
        : [],
    variants: variants.map((v) => toDisplayVariant(v, p.slug)),
  } as Product;
}

export interface Catalogue {
  products: Product[];
  isLoading: boolean;
  /** True when what is on screen is the bundled list, not the database. */
  isStale: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useCatalogue(): Catalogue {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const live = await fetchProducts();
      setProducts(live.map(toDisplayProduct));
      setIsStale(false);
    } catch (err) {
      // Something to look at beats a blank screen, but the screen is told it
      // is looking at a stand-in.
      setProducts(FALLBACK_PRODUCTS);
      setIsStale(true);
      setError(err instanceof Error ? err.message : 'Could not load the shelf.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { products, isLoading, isStale, error, reload: load };
}
