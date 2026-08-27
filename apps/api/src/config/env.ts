/**
 * Environment loading, in one place.
 *
 * This ran in three files with the same two-path incantation copied between
 * them, so which .env won depended on which module happened to construct
 * first. Importing this module loads them once, in a defined order.
 *
 * Import it before anything that reads process.env — main.ts does so at the
 * top of the file.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;

  // App-local first so it can override the shared root file.
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

  loaded = true;
}

loadEnv();

/** Reads a required variable, failing loudly rather than at first use. */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required but not set. Check your .env file.`);
  }

  return value;
}

export function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

export const env = {
  get nodeEnv(): string {
    return optionalEnv('NODE_ENV', 'development');
  },
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
  get port(): number {
    return Number(optionalEnv('PORT', '4000'));
  },
  get supabaseUrl(): string {
    return optionalEnv('SUPABASE_URL');
  },
  get supabaseKey(): string {
    return (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      ''
    );
  },
  get razorpayKeyId(): string {
    return optionalEnv('RAZORPAY_KEY_ID');
  },
  get razorpayKeySecret(): string {
    return optionalEnv('RAZORPAY_KEY_SECRET');
  },
  get cashfreeClientId(): string {
    return optionalEnv('CASHFREE_CLIENT_ID');
  },
  get cashfreeClientSecret(): string {
    return optionalEnv('CASHFREE_CLIENT_SECRET');
  },
  /** `sandbox` unless explicitly `production`. The safe direction to fail. */
  get cashfreeEnv(): string {
    return optionalEnv('CASHFREE_ENV') || 'sandbox';
  },
  get googleClientId(): string {
    return optionalEnv('GOOGLE_CLIENT_ID');
  },
};
