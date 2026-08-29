import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Flags the API itself branches on. Storefront-only flags live in the DB too. */
export const FLAG = {
  CART: 'ENABLE_CART',
  USER_ACCOUNTS: 'ENABLE_USER_ACCOUNTS',
  WEBSITE_PAYMENT: 'ENABLE_WEBSITE_PAYMENT',
  SUBSCRIPTIONS: 'ENABLE_SUBSCRIPTIONS',
  PRODUCT_RATINGS: 'ENABLE_PRODUCT_RATINGS',
  WALLET: 'ENABLE_WALLET',
  OTP_LOGIN: 'ENABLE_OTP_LOGIN',

  /**
   * Email and password sign-in. Phone OTP is the default way in now, and this
   * exists so the older form can be retired without deleting the accounts that
   * still depend on it.
   */
  EMAIL_LOGIN: 'ENABLE_EMAIL_LOGIN',
  GOOGLE_LOGIN: 'ENABLE_GOOGLE_LOGIN',

  /**
   * Hands checkout to Shiprocket. Off, the Checkout button behaves as it
   * always has. Their own script requires a fallbackUrl pointing at our
   * native checkout for when their server is down, so ours keeps working
   * either way — this adds a path rather than replacing one.
   */
  SHIPROCKET_CHECKOUT: 'ENABLE_SHIPROCKET_CHECKOUT',

  /**
   * Takes payment through Cashfree rather than Razorpay.
   *
   * A switch rather than a replacement: off, checkout behaves exactly as it
   * did, which matters because this is the first payment path on the site that
   * has ever actually opened a gateway. Razorpay stays wired underneath so
   * turning this off is a rollback rather than an outage.
   */
  CASHFREE_CHECKOUT: 'ENABLE_CASHFREE_CHECKOUT',

  /**
   * Where the discount rule lives, and only meaningful while the above is on.
   * Off, coupons are configured in Shiprocket's dashboard. On, we validate
   * against our own Coupon table and pass cart_discount at token creation.
   *
   * Never both: "If specified, only this fixed discount is applied" — passing
   * cart_discount switches their dashboard coupons off for that order. A
   * customer seeing one discount while the invoice shows another is the
   * failure this single flag prevents.
   */
  SHIPROCKET_OUR_COUPONS: 'ENABLE_SHIPROCKET_OUR_COUPONS',
} as const;

export type FlagKey = (typeof FLAG)[keyof typeof FLAG];

const CACHE_TTL_MS = 30_000;

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private cache = new Map<string, boolean>();
  private cachedAt = 0;

  constructor(private prisma: PrismaService) {}

  /**
   * Flags are read per request but cached briefly — a toggle in the admin
   * console should take effect in seconds without adding a query to every
   * storefront call.
   */
  private async load(): Promise<Map<string, boolean>> {
    if (Date.now() - this.cachedAt < CACHE_TTL_MS && this.cache.size > 0) {
      return this.cache;
    }

    const flags = await this.prisma.featureFlag.findMany();
    this.cache = new Map(flags.map((f) => [f.key, f.isEnabled]));
    this.cachedAt = Date.now();
    return this.cache;
  }

  /** Unknown flags are treated as off, so a missing row cannot open a feature. */
  async isEnabled(key: FlagKey): Promise<boolean> {
    const flags = await this.load();
    return flags.get(key) ?? false;
  }

  async getAll(): Promise<Record<string, boolean>> {
    const flags = await this.load();
    return Object.fromEntries(flags);
  }

  invalidate(): void {
    this.cachedAt = 0;
  }
}
