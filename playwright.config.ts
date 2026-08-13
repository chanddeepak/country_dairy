import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export const STOREFRONT = process.env.E2E_WEB_URL || 'http://localhost:3000';
export const ADMIN = process.env.E2E_ADMIN_URL || 'http://localhost:5173';
export const API = process.env.E2E_API_URL || 'http://localhost:4000/api';

/** Where signed-in sessions are cached between specs. */
export const STORAGE = {
  admin: 'e2e/.auth/admin.json',
  customer: 'e2e/.auth/customer.json',
  driver: 'e2e/.auth/driver.json',
};

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',

  // One worker, deliberately.
  //
  // Every project shares one database, and specs move stock, place orders and
  // sign roles in and out. Two workers passed individually and failed together
  // — the classic shape of a suite whose job is to gate production being the
  // least trustworthy thing in the pipeline. Isolating data per worker would
  // buy the parallelism back; until then, slow and honest.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  // The database is in another region: a single round trip is ~700ms and a
  // page can make several. Default timeouts assume a local database and fail
  // on latency that is entirely normal here.
  // Generous enough for a ~700ms-per-query database in another region, tight
  // enough that a selector which matches nothing fails fast rather than
  // stretching a broken run into quarter of an hour.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Signs in once per role and writes the storage states the rest reuse.
    { name: 'setup', testMatch: /global\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /global\.teardown\.ts/ },

    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      use: { baseURL: API },
      dependencies: ['setup'],
    },
    {
      name: 'storefront',
      testMatch: /storefront\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: STOREFRONT },
      dependencies: ['setup'],
    },
    {
      name: 'storefront-mobile',
      testMatch: /storefront\/.*\.spec\.ts/,
      // Layout and touch-target cases only; the flows are covered on desktop.
      grep: /@responsive/,
      use: { ...devices['Pixel 7'], baseURL: STOREFRONT },
      dependencies: ['setup'],
    },
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN },
      dependencies: ['setup'],
    },
  ],

  // The apps are expected to be running already. Starting them here would
  // fight the dev servers most people have open, and a cold Next build inside
  // a test run is its own source of flake.
});
