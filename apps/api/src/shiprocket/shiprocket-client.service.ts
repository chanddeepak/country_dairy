import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Our side of the conversation with Shiprocket.
 *
 * Everything before this was inbound: we serve a catalogue they pull and
 * receive a webhook they post. This is the first code that calls *them*, and it
 * signs requests the same way `ShiprocketAuthGuard` verifies theirs — API key
 * in a header, base64 HMAC-SHA256 of the exact body sent.
 *
 * The digest is taken over the same string that goes on the wire. Serialising
 * twice is how these integrations break: two `JSON.stringify` calls can differ
 * in key order, and every signature fails for a reason nothing reports.
 */

const STAGING = 'https://fastrr-api-dev.pickrr.com';
const PRODUCTION = 'https://checkout-api.shiprocket.com';

export interface CheckoutTokenResult {
  token: string;
  orderId?: string;
}

export interface CartItem {
  variant_id: number;
  quantity: number;
}

@Injectable()
export class ShiprocketClient {
  private readonly logger = new Logger(ShiprocketClient.name);

  /** Staging unless explicitly told otherwise — production is the opt-in. */
  private get baseUrl(): string {
    if (process.env.SHIPROCKET_BASE_URL) return process.env.SHIPROCKET_BASE_URL;
    return process.env.SHIPROCKET_ENV === 'production' ? PRODUCTION : STAGING;
  }

  /** True once someone has put real credentials in the environment. */
  get configured(): boolean {
    return Boolean(process.env.SHIPROCKET_API_KEY && process.env.SHIPROCKET_API_SECRET);
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const key = process.env.SHIPROCKET_API_KEY;
    const secret = process.env.SHIPROCKET_API_SECRET;

    // Unconfigured is a loud failure, not a quiet one. A checkout that silently
    // does nothing because a variable is missing is the worst of both: the
    // customer sees a dead button and the logs say everything is fine.
    if (!key || !secret) {
      this.logger.error(`Shiprocket credentials are not configured; refusing to call ${path}`);
      throw new ServiceUnavailableException('Shiprocket checkout is not configured');
    }

    // Signed and sent are the same bytes, deliberately.
    const body = JSON.stringify(payload);
    const digest = crypto.createHmac('sha256', secret).update(body).digest('base64');

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': key,
          'X-Api-HMAC-SHA256': digest,
        },
        body,
        // Their checkout is in front of a customer who is waiting. Better to
        // fail back to our own checkout than to hold a spinner indefinitely.
        signal: AbortSignal.timeout(12_000),
      });
    } catch (e) {
      this.logger.error(`Shiprocket ${path} did not respond: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Shiprocket did not respond');
    }

    const text = await res.text();
    if (!res.ok) {
      // Their body, in our log, at the status they gave. Anything less and the
      // first real integration failure is a guessing game.
      this.logger.error(`Shiprocket ${path} returned ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException('Shiprocket refused that request');
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error(`Shiprocket ${path} returned something that was not JSON`);
      throw new ServiceUnavailableException('Shiprocket returned an unreadable response');
    }
  }

  /**
   * A token their checkout window opens with.
   *
   * `cart_discount` is deliberately absent. Their documentation is explicit
   * that "if specified, only this fixed discount is applied" — passing it turns
   * off the coupons configured in their dashboard for that order. Sending our
   * own is what ENABLE_SHIPROCKET_OUR_COUPONS is for, and it is not on.
   */
  async createCheckoutToken(items: CartItem[], redirectUrl: string): Promise<CheckoutTokenResult> {
    const body = await this.post<{
      result?: { token?: string; data?: { order_id?: string } };
    }>('/api/v1/access-token/checkout', {
      cart_data: { items },
      redirect_url: redirectUrl,
      timestamp: new Date().toISOString(),
    });

    const token = body?.result?.token;
    if (!token) {
      this.logger.error('Shiprocket accepted the cart but returned no token');
      throw new ServiceUnavailableException('Shiprocket returned no checkout token');
    }

    return { token, orderId: body.result?.data?.order_id };
  }

  /**
   * One order, straight from them.
   *
   * Their own documentation says webhooks may be missed, and recommends this as
   * the failsafe. Used by the reconciliation job rather than by checkout.
   */
  async fetchOrderDetails(orderId: string): Promise<unknown> {
    return this.post('/api/v1/custom-platform-order/details', { order_id: orderId });
  }
}
