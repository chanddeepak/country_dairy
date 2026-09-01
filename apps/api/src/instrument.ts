// Must be imported before anything else, so Sentry can patch the libraries it
// instruments before they are loaded. That is why main.ts imports it first and
// why this file does the env loading itself rather than relying on ordering.
import './config/env';

import * as Sentry from '@sentry/nestjs';

/**
 * Crash reporting for the API.
 *
 * Inert until SENTRY_DSN is set — the wiring is committed so switching it on
 * in production is pasting one value into Render rather than a code change.
 * Without a DSN nothing initialises and nothing leaves the process, so local
 * runs and the test suites are untouched.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    /*
     * Off deliberately. This API handles phone numbers, delivery addresses and
     * order totals; sendDefaultPii would attach request bodies and headers to
     * every report, which is how a crash tracker becomes a copy of the
     * customer database.
     */
    sendDefaultPii: false,
  });
}
