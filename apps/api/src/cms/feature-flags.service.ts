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
