import { API_URL } from './constants';

/**
 * Hero artwork lives in object storage, so a stored path needs a host in front
 * of it. Kept beside the mapping rather than inside the component, because the
 * server now builds these slides too and both halves have to agree on the URL.
 */
export function resolveHeroImageUrl(url?: string): string {
  if (!url) return '/images/hero-banner.png';
  if (url.startsWith('/hero-banners/') || url.startsWith('/products/')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return `${supabaseUrl}/storage/v1/object/public${url}`;
  }
  if (url.startsWith('/storage/v1/object/public/')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return `${supabaseUrl}${url}`;
  }
  if (url.startsWith('/uploads/')) {
    const apiHost = API_URL.replace(/\/api\/?$/, '');
    return `${apiHost}${url}`;
  }
  return url;
}

/** The CMS rows turned into what the carousel renders. Pure. */
export function mapHeroBanners(desktopBanners: any[], mobileBanners: any[]): any[] {
  const primaryBanners = desktopBanners.length > 0 ? desktopBanners : mobileBanners;

  return primaryBanners.map((b: any, idx: number) => {
    const mobMatch = mobileBanners[idx] || mobileBanners[0] || b;
    return {
      id: b.id || idx,
      image: resolveHeroImageUrl(b.imageUrl || '/images/hero-banner.png'),
      mobileImage: resolveHeroImageUrl(mobMatch.imageUrl || b.imageUrl || '/images/hero-banner.png'),
      objectPosition: 'center',
      headline: b.title,
      subtitle: b.subtitle,
      // The column has existed since August and nothing read it. A
      // poster-style banner carries its own headline, so the storefront
      // must not lay a second one over the top.
      imageHasText: Boolean(b.imageHasText),
      ctaText: b.ctaText || 'Shop All Products',
      ctaHref: b.ctaLink || '/products',
      // The desktop row owns the placement; the mobile row is only
      // consulted for its artwork, since anchors are relative and
      // survive the narrower box on their own.
      layout: b.layout ?? null,
    };
  });
}

/**
 * The slides, fetched on the server.
 *
 * This is what moves the hero image off the critical path behind JavaScript.
 * The banner used to be requested only after the bundle had loaded, hydrated
 * and made two API calls, which is why the largest paint on the homepage
 * landed around ten seconds however small the artwork was.
 *
 * Returns null when there is nothing to show, so the caller can fall back to
 * its own static slides rather than render an empty carousel.
 */
export async function fetchHeroSlides(): Promise<any[] | null> {
  try {
    const [desktopRes, mobileRes] = await Promise.all([
      fetch(`${API_URL}/cms/hero?deviceType=DESKTOP`, { next: { revalidate: 300 } }),
      fetch(`${API_URL}/cms/hero?deviceType=MOBILE`, { next: { revalidate: 300 } }),
    ]);

    const desktopBanners = desktopRes.ok ? await desktopRes.json() : [];
    const mobileBanners = mobileRes.ok ? await mobileRes.json() : [];

    if (!Array.isArray(desktopBanners) || !Array.isArray(mobileBanners)) return null;
    if (desktopBanners.length === 0 && mobileBanners.length === 0) return null;

    return mapHeroBanners(desktopBanners, mobileBanners);
  } catch {
    return null;
  }
}
