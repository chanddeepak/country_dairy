/**
 * Crash reporting in the customer's browser.
 *
 * Loaded only when NEXT_PUBLIC_SENTRY_DSN is set, and imported dynamically so
 * that when it is not, the SDK is not in the bundle at all. A static import
 * costs every visitor 181KB of JavaScript for a reporter that cannot report
 * anywhere — measured, by building both ways: 1,675KB against 1,494KB.
 *
 * That matters more than it sounds. The largest paint on this site is already
 * bound by bandwidth rather than by image size — the hero cannot start
 * downloading until the JavaScript and fonts have had their share — so an
 * unused SDK is not free, it is a second of someone's patience.
 *
 * It has to be a NEXT_PUBLIC_ value because it is compiled into the bundle,
 * which is also why it must be the DSN and never a token: a DSN is write-only
 * by design and safe to ship.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import('@sentry/nextjs').then((SentryModule) => {
    SentryModule.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV || 'development',
      tracesSampleRate: 0,
      // Session replay is off. It records what a customer typed, which on this
      // site includes a mobile number and a delivery address.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
    });
  });
}

/*
 * Declared without importing the SDK.
 *
 * Exporting Sentry.captureRouterTransitionStart directly pulls the whole
 * package back into the bundle, which defeats the dynamic import above — the
 * first attempt at this measured 2,085KB, worse than the static version,
 * because the SDK was then included twice. This forwards to it only once it
 * has actually loaded.
 */
let routerTransitionStart: ((href: string, navigationType: string) => void) | undefined;

if (dsn) {
  void import('@sentry/nextjs').then((SentryModule) => {
    routerTransitionStart = SentryModule.captureRouterTransitionStart;
  });
}

export const onRouterTransitionStart = (href: string, navigationType: string) => {
  routerTransitionStart?.(href, navigationType);
};
