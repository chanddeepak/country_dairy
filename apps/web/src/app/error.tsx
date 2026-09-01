'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

/**
 * The route-level error boundary.
 *
 * Without one, a render error anywhere under the root layout shows Next's own
 * screen — in production a bare "Application error", with no way back into the
 * shop. This keeps the customer on the site and gives them a retry, which is
 * often all a failed fetch needs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /*
     * Reported, not just logged.
     *
     * The digest is what ties the reference shown to the customer below to a
     * real trace. It used to go to console.error, which nobody reads — on
     * launch day a customer hitting this was invisible. Sentry is inert
     * without a DSN, so this stays a console line locally.
     */
    Sentry.captureException(error, { tags: { digest: error.digest ?? 'none' } });
    // eslint-disable-next-line no-console
    console.error('[storefront] render error', error.digest ?? '', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--ivory)] px-6 py-20 text-center text-[var(--ink)]">
      <h1 className="max-w-xl font-serif text-4xl leading-tight text-balance sm:text-5xl">
        Something went wrong at our end
      </h1>

      <p className="mt-4 max-w-md font-sans text-[var(--ink-soft)]">
        Nothing you did caused this, and nothing in your basket has been lost.
        Try again, and if it keeps happening, please get in touch.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="rounded-sm bg-[var(--forest)] px-8 py-3.5 font-sans text-sm font-bold text-white transition hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-sm border-2 border-[var(--forest)] px-8 py-3.5 font-sans text-sm font-bold text-[var(--forest)] transition hover:bg-[var(--forest)] hover:text-white"
        >
          Back home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 font-sans text-xs text-[var(--ink-soft)]">
          Reference: <code>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
