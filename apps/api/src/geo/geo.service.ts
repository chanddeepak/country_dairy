import { Injectable, Logger } from '@nestjs/common';

export interface PincodeLookup {
  pincode: string;
  state: string;
  district: string;
  /** Localities sharing this code, for the customer to pick from. */
  localities: string[];
}

/** Six digits, and the first is never zero — no Indian PIN code starts with 0. */
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

/**
 * PIN code lookup, proxied rather than called from the browser.
 *
 * Three reasons it lives here instead of in the checkout page:
 *
 *   - The result is cacheable and shared. PIN codes effectively never change,
 *     so one lookup serves every customer in that area for the life of the
 *     process.
 *   - The browser would otherwise talk to a third party directly on a page
 *     where someone is typing their home address, and CORS would be theirs to
 *     grant or withdraw without warning.
 *   - It can fail quietly here. Address entry must never depend on somebody
 *     else's uptime.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  /**
   * Unbounded on purpose: there are about 19,000 PIN codes in India and each
   * entry is a few hundred bytes, so the whole country is a rounding error
   * against the container's memory. A TTL would only buy staleness for data
   * that does not go stale.
   */
  private readonly cache = new Map<string, PincodeLookup | null>();

  async lookup(pincode: string): Promise<PincodeLookup | null> {
    if (!PINCODE_PATTERN.test(pincode)) return null;

    const cached = this.cache.get(pincode);
    if (cached !== undefined) return cached;

    try {
      // Short, because this sits in front of somebody typing. A slow answer
      // is worse than no answer: they have already moved to the next field.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      clearTimeout(timer);

      if (!res.ok) return this.remember(pincode, null);

      const body = (await res.json()) as Array<{
        Status?: string;
        PostOffice?: Array<{ Name?: string; District?: string; State?: string }> | null;
      }>;

      const first = body?.[0];
      const offices = first?.PostOffice ?? [];
      if (first?.Status !== 'Success' || offices.length === 0) {
        // A real answer meaning "no such PIN code". Worth caching, or every
        // typo becomes a fresh outbound request.
        return this.remember(pincode, null);
      }

      const state = offices[0]?.State?.trim() ?? '';
      const district = offices[0]?.District?.trim() ?? '';
      if (!state) return this.remember(pincode, null);

      return this.remember(pincode, {
        pincode,
        state,
        district,
        localities: [
          ...new Set(
            offices
              .map((o) => o.Name?.trim())
              .filter((n): n is string => Boolean(n)),
          ),
        ],
      });
    } catch (error) {
      // Deliberately not cached: a timeout says something about the network
      // this minute, not about the PIN code. Caching it would make one bad
      // moment permanent for that area.
      this.logger.warn(
        `PIN code lookup failed for ${pincode}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private remember(pincode: string, value: PincodeLookup | null): PincodeLookup | null {
    this.cache.set(pincode, value);
    return value;
  }
}
