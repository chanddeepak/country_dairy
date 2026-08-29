'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { useApp } from '../context/AppContext';
import { useStoreConfig } from '../context/StoreConfigContext';

/**
 * Placing the order and opening the payment window, in one place.
 *
 * This used to live inside the checkout page, which meant getting there was a
 * navigation — a page load, a spinner, and a URL the shopper never wanted to
 * visit. Cashfree's window is a modal, so it can open over whatever they were
 * already looking at; the only navigation left is the one that matters, to the
 * order, once the money has moved.
 *
 * It is a hook rather than a function so any surface can start a checkout —
 * the cart drawer today, a Buy Now button tomorrow — without one of them
 * quietly growing its own version. That is exactly how the home page ended up
 * opening a sign-in modal where every other page navigated.
 */
export function useCheckoutFlow() {
  const router = useRouter();
  const { checkout } = useApp();
  const { isFlagOn, isLoading: configLoading } = useStoreConfig();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  // Guards a second click while the first is still in flight: two orders would
  // be created and stock held against both.
  const inFlight = useRef(false);

  const start = useCallback(
    async (addressId?: string) => {
      if (inFlight.current || configLoading) return;
      inFlight.current = true;
      setStarting(true);
      setError('');

      try {
        /*
         * With Cashfree off, checkout is still the old page and the old flow.
         * Navigating rather than creating the order here keeps turning the flag
         * off a rollback rather than an outage.
         */
        if (!isFlagOn('ENABLE_CASHFREE_CHECKOUT')) {
          router.push('/checkout');
          return;
        }

        const result = await checkout(addressId);

        if (!result?.orderId) {
          setError(result?.message || 'We could not start your checkout. Please try again.');
          return;
        }

        if (result.provider !== 'CASHFREE' || !result.paymentSessionId) {
          // The server chose another gateway despite the flag. Hand over to the
          // page that knows how to finish that, rather than guessing here.
          router.push('/checkout');
          return;
        }

        /*
         * sessionStorage, not the URL: presenting this token settles the order
         * and returns a session, so a query string would write a credential
         * into history and into any Referer this tab later sends.
         */
        if (result.claimToken) {
          sessionStorage.setItem(`cd_claim_${result.orderId}`, result.claimToken);
        }

        const cashfree = await loadCashfree({
          mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
        });

        if (!cashfree) {
          setError('The payment window could not be opened. Please try again.');
          return;
        }

        // Resolves when their modal closes, however it closed. The order is
        // already created and its stock already held, so the return page
        // settles it either way — and the webhook settles it independently if
        // this tab is closed mid-payment.
        await cashfree.checkout({
          paymentSessionId: result.paymentSessionId,
          redirectTarget: '_modal',
        });

        router.push(`/checkout/cashfree-return?order_id=${result.orderId}`);
      } catch (err) {
        console.error('Checkout failed to start:', err);
        setError('Something went wrong starting your checkout. Please try again.');
      } finally {
        inFlight.current = false;
        setStarting(false);
      }
    },
    [checkout, configLoading, isFlagOn, router],
  );

  return { start, starting, error };
}
