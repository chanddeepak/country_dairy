import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_URL, resolveStorefrontImageUrl } from '../../../lib/constants';

interface GalleryImage {
  imageUrl: string | null;
  altText: string | null;
  isPrimary: boolean;
  mediaType: string;
}

interface ProductSeo {
  title: string;
  tagline: string | null;
  storyDescription: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  galleryImages: GalleryImage[] | null;
}

/**
 * One product, for the metadata and for the 404 decision.
 *
 * Both callers use the same URL and cache options, so Next serves the second
 * from the first — this is one request per render, not two.
 *
 * `undefined` means no such product and `null` means the lookup failed, and
 * the two must not be treated alike: 404-ing a real product because the API
 * blinked would drop it out of search results.
 */
async function findProduct(slug: string): Promise<ProductSeo | undefined | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (res.status === 404) return undefined;
    if (!res.ok) return null;
    return (await res.json()) as ProductSeo;
  } catch {
    return null;
  }
}

/** First sentence-ish, for a description that has to fit in a search result. */
function trim(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max).trimEnd()}…`;
}

/**
 * What search and a shared link see for a product.
 *
 * The page is a client component — gallery, variant picker, cart drawer — and
 * a client component cannot export metadata, so this sits beside it. Without
 * it every product served the homepage title and description, which is what
 * they all did until now.
 *
 * metaTitle and metaDescription have been columns on the product all along and
 * nothing read them; they win when set, so the catalogue can override without
 * a deploy.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) return {};

  const title = product.metaTitle?.trim() || product.title;
  const description = trim(
    product.metaDescription?.trim() ||
      product.tagline?.trim() ||
      product.storyDescription?.trim() ||
      `${product.title} from Country Dairy.`,
  );

  const images = (product.galleryImages ?? [])
    .filter((g) => g.mediaType === 'IMAGE' && g.imageUrl)
    // The primary shot first — whichever image leads is the one that appears
    // when the link is shared.
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .slice(0, 1)
    .map((g) => ({
      url: resolveStorefrontImageUrl(g.imageUrl),
      alt: g.altText || product.title,
    }));

  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      type: 'website',
      title: `${title} | Country Dairy`,
      description,
      url: `/products/${slug}`,
      ...(images.length ? { images } : {}),
    },
    ...(images.length
      ? { twitter: { card: 'summary_large_image' as const, title, description, images: [images[0].url] } }
      : {}),
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await findProduct(slug);

  // Here rather than in the page: a client component's notFound() runs after
  // hydration, so the customer sees the 404 screen but a 200 has already gone
  // out and a crawler records a real page at a URL that does not exist.
  if (product === undefined) notFound();

  return children;
}
