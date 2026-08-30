import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/constants';

/**
 * What a crawler may read.
 *
 * The disallow list is not about secrecy — every one of these routes already
 * requires a session or a claim token, and a crawler reaching them gets
 * nothing. It is about not spending the crawl budget on pages that are
 * per-customer and can never rank, and not letting an order URL end up in an
 * index because somebody shared a link.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/checkout', '/orders/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
