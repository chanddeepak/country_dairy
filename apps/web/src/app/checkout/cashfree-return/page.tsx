'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import { useApp } from '../../../context/AppContext';

/**
 * Where the customer lands after Cashfree.
 *
 * Nothing here decides whether the payment succeeded. The browser says which
 * order, the server asks Cashfree, and Cashfree's answer is the only one that
 * counts — a page that trusted a query parameter would mark orders paid for
 * anyone who could type a URL.
 *
 * It also polls, because the two things that settle an order race each other:
 * this trip and the webhook. Cashfree can take a moment to move an order to
 * PAID after the modal closes, so a single check that came back ACTIVE would
 * strand a customer who had genuinely paid.
 */
const ATTEMPTS = 6;
const GAP_MS = 2000;

function CashfreeReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const { confirmCashfreeOrder, user } = useApp();

  const orderId = params.get('order_id');
  const [state, setState] = useState<'checking' | 'paid' | 'unpaid' | 'missing'>(
    orderId ? 'checking' : 'missing',
  );
  // Strict mode mounts effects twice in development; without this the poll
  // runs in duplicate and the two loops fight over the same state.
  const started = useRef(false);

  const poll = useCallback(async () => {
    if (!orderId) return;

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const { paid } = await confirmCashfreeOrder(orderId);
      if (paid) {
        setState('paid');
        router.replace(`/orders/${orderId}?status=success`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, GAP_MS));
    }

    // Not a failure. The webhook is still coming, and it settles the order
    // whether or not this tab is open — so the honest message is "not yet",
    // with somewhere to look.
    setState('unpaid');
  }, [orderId, confirmCashfreeOrder, router]);

  useEffect(() => {
    if (!orderId || started.current || !user) return;
    started.current = true;
    void poll();
  }, [orderId, poll, user]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar onCartOpen={() => {}} onAuthOpen={() => {}} />

      <main className="flex flex-1 items-center justify-center bg-[var(--ivory)] px-4 py-24">
        <div className="w-full max-w-md text-center">
          {state === 'checking' && (
            <>
              <Loader2 className="mx-auto mb-6 h-8 w-8 animate-spin text-[var(--forest)]" />
              <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                Confirming your payment
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
                Checking with Cashfree. This takes a few seconds — please don&rsquo;t close
                this page.
              </p>
            </>
          )}

          {state === 'paid' && (
            <>
              <CheckCircle2 className="mx-auto mb-6 h-8 w-8 text-[var(--ok)]" />
              <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                Payment received
              </h1>
              <p className="mt-3 text-[14px] text-[var(--ink-soft)]">Taking you to your order.</p>
            </>
          )}

          {state === 'unpaid' && (
            <>
              <AlertCircle className="mx-auto mb-6 h-8 w-8 text-[var(--warn)]" />
              <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                We haven&rsquo;t seen the payment yet
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
                If you completed it, the confirmation usually arrives within a minute and your
                order will update on its own. Nothing has been charged twice, and you do not
                need to pay again.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/orders/${orderId}`}
                  className="inline-flex items-center rounded-sm bg-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ivory)] transition-colors hover:bg-[var(--pine)]"
                >
                  View the order
                </Link>
                <Link
                  href="/account?tab=orders"
                  className="inline-flex items-center rounded-sm border border-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forest)] transition-colors hover:bg-[var(--forest)] hover:text-[var(--ivory)]"
                >
                  All my orders
                </Link>
              </div>
            </>
          )}

          {state === 'missing' && (
            <>
              <AlertCircle className="mx-auto mb-6 h-8 w-8 text-[var(--danger)]" />
              <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                We couldn&rsquo;t tell which order this was
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
                Your orders page will show the latest state of anything you have placed.
              </p>
              <Link
                href="/account?tab=orders"
                className="mt-8 inline-flex items-center rounded-sm bg-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ivory)] transition-colors hover:bg-[var(--pine)]"
              >
                All my orders
              </Link>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CashfreeReturnPage() {
  // useSearchParams needs a Suspense boundary or `next build` fails — it
  // type-checks and dev-compiles perfectly well without one, which is exactly
  // how it reached production on this project once before.
  return (
    <Suspense fallback={null}>
      <CashfreeReturn />
    </Suspense>
  );
}
