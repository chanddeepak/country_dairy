'use client';

import { useCallback, useRef, useState } from 'react';
import { API_URL } from './constants';

/**
 * Their checkout, driven from our cart.
 *
 * The sequence is fixed by their integration: we ask our own API for a token,
 * their script is loaded into the page, and `HeadlessCheckout.addToCart` is
 * handed the token plus the click event that started it. Their window takes
 * over from there and the customer comes back to `redirect_url`.
 *
 * The token is minted server-side, never here — it is signed with the API
 * secret, and a secret that reaches the browser is not a secret.
 */

/** Where their script lives, by environment. Staging is the Netlify host. */
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_SHIPROCKET_SCRIPT_URL ||
  'https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js';

declare global {
  interface Window {
    HeadlessCheckout?: {
      addToCart: (
        event: unknown,
        token: string,
        options?: { fallbackUrl?: string },
      ) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loaded once per page, and only when somebody actually chooses this checkout. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.HeadlessCheckout) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = SCRIPT_URL;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        // Let a later attempt try again: this describes the network now, not
        // whether their checkout exists.
        scriptPromise = null;
        reject(new Error('Could not load the Shiprocket checkout'));
      };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

export interface CartLine {
  variantExternalId: number;
  quantity: number;
}

export function useShiprocketCheckout() {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const startCheckout = useCallback(
    async (event: unknown, lines: CartLine[]): Promise<boolean> => {
      if (busy.current) return false;
      busy.current = true;
      setStarting(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/shiprocket/checkout/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The basket only. Where their window returns the customer is decided
          // on the server: a redirect we chose here would be signed with the
          // API secret, which is an open redirect wearing our own signature.
          body: JSON.stringify({ items: lines }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Could not start that checkout');
        }

        const { token } = await res.json();
        await loadScript();

        if (!window.HeadlessCheckout) {
          throw new Error('Could not load the Shiprocket checkout');
        }

        // fallbackUrl is where their script sends people if their own server is
        // down. It points at our checkout, which is the reason ours has to keep
        // working whatever happens here — this adds a path, it never replaces
        // one.
        window.HeadlessCheckout.addToCart(event, token, {
          fallbackUrl: `${window.location.origin}/checkout`,
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start that checkout');
        return false;
      } finally {
        busy.current = false;
        setStarting(false);
      }
    },
    [],
  );

  return { startCheckout, starting, error };
}
