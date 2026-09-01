import * as Sentry from '@sentry/nextjs';

/**
 * Crash reporting for the server side of the storefront.
 *
 * Inert until SENTRY_DSN is set. That is deliberate: the wiring lands in the
 * repository now so switching it on in production is pasting one value into
 * Render, not a deploy. With no DSN, Sentry.init is never called and nothing
 * is sent anywhere — local development and the test suites are unaffected.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV,
    // Traces cost money and answer a question nobody is asking yet. Errors are
    // the point; sampling can be raised once there is traffic to sample.
    tracesSampleRate: 0,
    // A customer's phone number and address pass through this app. None of it
    // belongs in a crash report.
    sendDefaultPii: false,
  });
}

/**
 * Next calls this for an error thrown while rendering on the server, which is
 * the one class the client-side handler cannot see.
 */
export const onRequestError = Sentry.captureRequestError;
