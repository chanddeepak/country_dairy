'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { useApp } from '../context/AppContext';
import { useStoreConfig } from '../context/StoreConfigContext';

const PENDING_KEY = 'cd_pending_checkout';

/** The checkout this tab started and has not finished. */
function readPendingCheckout(): { orderId: string; claimToken?: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as { orderId: string; claimToken?: string }) : null;
  } catch {
    return null;
  }
}

function writePendingCheckout(orderId: string, claimToken?: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderId, claimToken }));
  } catch {
    // Private browsing, or storage full. Losing this only means the next
    // attempt creates a new order, which is what used to happen anyway.
  }
}

function clearPendingCheckout() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* see above */
  }
}

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
  const { checkout, confirmCashfreeOrder, abandonOrder } = useApp();
  const { isFlagOn, isLoading: configLoading } = useStoreConfig();

  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  // Guards a second click while the first is still in flight: two orders would
  // be created and stock held against both.
  const inFlight = useRef(false);

  /**
   * Gives the payment a few seconds to land before deciding it did not.
   *
   * Cashfree can take a moment to move an order to PAID after the window
   * closes, so a single check would strand somebody who genuinely paid — and
   * telling a paying customer their payment failed is the worst outcome here.
   */
  const pollForPayment = useCallback(
    async (orderId: string) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { paid } = await confirmCashfreeOrder(
          orderId,
          sessionStorage.getItem(`cd_claim_${orderId}`) ?? undefined,
        );
        if (paid) {
          sessionStorage.removeItem(`cd_claim_${orderId}`);
          return true;
        }
        await new Promise((r) => setTimeout(r, 1800));
      }
      return false;
    },
    [confirmCashfreeOrder],
  );

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

        /*
         * Offer the last interrupted checkout back to the server.
         *
         * Kept per tab, because that is the life of the thing it describes:
         * somebody who closed the payment window and is trying again. The
         * server decides whether it is really resumable and quietly makes a
         * new order if not, so a stale value here costs nothing.
         */
        const pending = readPendingCheckout();
        const result = await checkout(addressId, pending ?? undefined);

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
        // Remembered so closing the window and coming back picks this up
        // rather than starting another order.
        writePendingCheckout(result.orderId, result.claimToken);

        const cashfree = await loadCashfree({
          mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
        });

        if (!cashfree) {
          setError('The payment window could not be opened. Please try again.');
          return;
        }

        // Resolves when their modal closes, however it closed — paid,
        // declined, or dismissed. The SDK does not reliably say which, so the
        // server is asked rather than guessed at.
        const outcome = await cashfree.checkout({
          paymentSessionId: result.paymentSessionId,
          redirectTarget: '_modal',
        });

        /*
         * Cashfree says which kind of ending this was.
         *
         * Answering "Yes, Leave" to their own "Leaving Checkout?" prompt
         * resolves with error.code 'payment_aborted' — a decision, not a
         * silence. Closing the order straight away means the stock goes back
         * now rather than in an hour, and no phantom order is left behind for
         * the customer or the desk to wonder about.
         *
         * The server still asks the gateway before cancelling anything: an
         * abort can be reported after the bank has already taken the money.
         */
        const aborted = outcome?.error?.code === 'payment_aborted';
        if (aborted) {
          await abandonOrder(
            result.orderId,
            sessionStorage.getItem(`cd_claim_${result.orderId}`) ?? undefined,
          );
          /*
           * The claim token and the pointer both stay. The order is kept alive
           * for the hour precisely so coming back reuses it, and throwing away
           * the proof it belongs to this browser would defeat that.
           */
          setError('Checkout cancelled. Your basket is still here whenever you are ready.');
          return;
        }

        /*
         * Ask before going anywhere.
         *
         * Sending everyone to the return page meant a customer who simply
         * changed their mind and closed the window landed on "We haven't seen
         * the payment yet" — a page that reads like something went wrong, on a
         * URL they never asked for, having done nothing wrong at all.
         *
         * So the confirm runs here, and the only thing that earns a navigation
         * is a payment that actually happened. Anyone else stays exactly where
         * they were with their basket intact.
         */
        setStarting(false);
        setConfirming(true);
        const paid = await pollForPayment(result.orderId);

        if (paid) {
          clearPendingCheckout();
          router.push(`/orders/${result.orderId}?status=success`);
          return;
        }

        // Not paid, and that is usually a choice rather than a fault. The
        // order stays PENDING, the webhook settles it if the money does turn
        // up, and the sweep releases its stock if it never does.
        setError('Payment was not completed. Your basket is still here whenever you are ready.');
      } catch (err) {
        console.error('Checkout failed to start:', err);
        setError('Something went wrong starting your checkout. Please try again.');
      } finally {
        inFlight.current = false;
        setStarting(false);
        setConfirming(false);
      }
    },
    [checkout, confirmCashfreeOrder, abandonOrder, configLoading, isFlagOn, router],
  );

  return { start, starting, confirming, error };
}
