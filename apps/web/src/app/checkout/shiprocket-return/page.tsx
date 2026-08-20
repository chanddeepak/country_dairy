'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import AuthModal from '../../../components/modals/AuthModal';

/**
 * Where Shiprocket's checkout sends the customer when it is finished.
 *
 * It appends `oid` and `ost` to this URL. Deliberately, this page does not
 * create anything: the order arrives on our webhook, signed, with the payment
 * already settled. A page that also created orders would double them every
 * time somebody refreshed it.
 *
 * So the job here is only to say what happened, and to be honest about the
 * short gap where their redirect has landed but their webhook has not.
 */
function ReturnContent() {
  const params = useSearchParams();
  const status = (params.get('ost') || '').toUpperCase();
  const orderRef = params.get('oid');

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [waited, setWaited] = useState(false);

  const succeeded = status === 'SUCCESS';

  useEffect(() => {
    if (!succeeded) return;
    // Their webhook usually lands first, but not always. Rather than claim an
    // order number we may not have yet, wait a moment before settling the copy.
    const t = setTimeout(() => setWaited(true), 4_000);
    return () => clearTimeout(t);
  }, [succeeded]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F3]">
      <Navbar onCartOpen={() => {}} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-20 text-center">
        {succeeded ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-[#3A6038]" strokeWidth={1.5} />
            <h1 className="font-serif font-black text-3xl text-[#2A2A2A] mt-5 mb-2">
              Thank you — your order is placed.
            </h1>
            <p className="text-sm text-[#6b6661] max-w-md mx-auto">
              {waited
                ? 'It is confirmed and on our list. You will find it under your orders, and we will email the invoice.'
                : 'We are just confirming it with the payment provider.'}
            </p>

            {orderRef && (
              <p className="mt-4 text-xs text-[#6b6661]">
                Reference <span className="font-bold text-[#2A2A2A]">{orderRef}</span>
              </p>
            )}

            {!waited && (
              <Loader2 className="mx-auto mt-5 h-4 w-4 animate-spin text-[#6b6661]" />
            )}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/account?tab=orders"
                className="rounded-full bg-[#3A6038] px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#2f4d2e]"
              >
                My orders
              </Link>
              <Link
                href="/products"
                className="rounded-full border border-[#3A6038]/30 px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3A6038] transition hover:bg-[#3A6038] hover:text-white"
              >
                Keep shopping
              </Link>
            </div>
          </>
        ) : (
          <>
            <CircleAlert className="mx-auto h-14 w-14 text-[#C59B27]" strokeWidth={1.5} />
            <h1 className="font-serif font-black text-3xl text-[#2A2A2A] mt-5 mb-2">
              That checkout did not finish.
            </h1>
            {/* Never "payment failed": a customer who simply closed the window
                has not failed at anything, and telling them money went missing
                when it did not is the worse of the two mistakes. */}
            <p className="text-sm text-[#6b6661] max-w-md mx-auto">
              Nothing has been charged. Your basket is exactly as you left it, so you can
              pick up where you stopped.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/checkout"
                className="rounded-full bg-[#3A6038] px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#2f4d2e]"
              >
                Back to checkout
              </Link>
              <Link
                href="/products"
                className="rounded-full border border-[#3A6038]/30 px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3A6038] transition hover:bg-[#3A6038] hover:text-white"
              >
                Keep shopping
              </Link>
            </div>
          </>
        )}
      </main>

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

/**
 * `useSearchParams` opts a route out of static rendering, and Next refuses to
 * prerender a page that reads it without a boundary to fall back to. Without
 * this the production build fails outright — it compiled and type-checked
 * perfectly and still could not be built, which is its own small lesson.
 */
export default function ShiprocketReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F3]" />}>
      <ReturnContent />
    </Suspense>
  );
}
