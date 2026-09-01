import * as Sentry from '@sentry/nextjs';

/**
 * Crash reporting in the customer's browser.
 *
 * Inert until NEXT_PUBLIC_SENTRY_DSN is set. It has to be a NEXT_PUBLIC_ value
 * because it is compiled into the bundle — which is also why it must be the
 * DSN and never a token: a DSN is write-only by design and safe to ship.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV || 'development',
    tracesSampleRate: 0,
    // Session replay is off. It records what a customer typed, which on this
    // site includes a mobile number and a delivery address.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
