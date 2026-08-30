import { API_URL } from '../../../lib/constants';

/**
 * One product from the catalogue, fetched on the server.
 *
 * Shared by the layout (which needs it for the title and the 404 decision) and
 * the page (which needs it to render). Both call this with the same URL and
 * the same cache options, so React serves the second from the first — one
 * request per render, not two. Writing the fetch twice is how those two
 * quietly drift into disagreeing about what a missing product looks like.
 *
 * `undefined` means no such product; `null` means the lookup failed. They must
 * stay distinct: 404-ing a real product because the API blinked would drop it
 * out of search results.
 */
export async function getProduct(slug: string): Promise<any | undefined | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}`, {
      /*
       * Never cached. This response decides whether the Add to cart button is
       * enabled, and a five-minute cache here offered a sold-out variant for
       * sale for five minutes — which a spec caught within an hour of it being
       * written. Titles could tolerate staleness; stock cannot, and the two
       * come from the same call.
       *
       * React still memoises identical fetches within one render, so the
       * layout and the page share a single request.
       */
      cache: 'no-store',
    });
    if (res.status === 404) return undefined;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
