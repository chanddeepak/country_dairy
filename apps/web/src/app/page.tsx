import HomeClient from './HomeClient';
import { fetchHeroSlides } from '../lib/heroSlides';

/**
 * The server half of the homepage.
 *
 * Its only job is to have the hero banners in hand before the response is
 * sent. Everything below is unchanged and still runs on the client — the cart
 * drawer, the auth modal and the subscription modal all need state — but the
 * largest image on the site no longer waits for JavaScript to discover it.
 */
export default async function Home() {
  const initialHeroSlides = await fetchHeroSlides();
  return <HomeClient initialHeroSlides={initialHeroSlides} />;
}
