import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { GatewayPayment, safeEqual } from './razorpay.service';

/** A line on the Cashfree checkout's cart summary. */
export interface CashfreeCartItem {
  item_id: string;
  item_name: string;
  item_original_unit_price: number;
  item_discounted_unit_price: number;
  item_quantity: number;
  item_currency: string;
}

/** What `POST /pg/orders` gives back, of what we use. */
export interface CashfreeOrder {
  cf_order_id: string;
  order_id: string;
  order_status: string;
  payment_session_id: string;
}

/**
 * An address as One Click Checkout returns it.
 *
 * Field names are theirs, verified against the Get Order Extended reference —
 * `address_line_one`, not `address1`; `pin_code`, not `pincode`. An earlier
 * guess at these names type-checked perfectly and read `undefined` from every
 * field, so the customer's chosen address was silently discarded and ours kept.
 * Nothing would have failed; the parcel would just have gone to the wrong door.
 */
export interface CashfreeAddress {
  name?: string;
  phone?: string;
  email?: string;
  address_line_one?: string;
  address_line_two?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pin_code?: string;
  country?: string;
  country_code?: string;
}

/** Who Cashfree says placed the order. */
export interface CashfreeCustomerDetails {
  customer_id?: string;
  customer_uid?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

/**
 * Cashfree Payment Gateway, and the One Click Checkout built on top of it.
 *
 * Deliberately shaped like `RazorpayService` — create an order, verify what
 * comes back, read a payment entity — so the two are swappable and neither
 * leaks its vocabulary into `orders.service.ts`.
 *
 * Two differences from Razorpay worth knowing:
 *
 * 1. **Rupees, not paise.** Razorpay counts in paise and this codebase counts
 *    in rupees, so `RazorpayService` divides by 100 on the way out. Cashfree
 *    already speaks rupees. Nothing is scaled here, and adding a division
 *    "for consistency" would quietly undercharge by 100x.
 * 2. **The webhook signs a timestamp too.** Razorpay signs the raw body alone;
 *    Cashfree signs `timestamp + rawBody`, and base64s the digest rather than
 *    hex. Getting either wrong fails every webhook, intermittently enough to
 *    look like their bug.
 *
 * Written against the API directly rather than the `cashfree-pg` SDK. The SDK
 * exists and wraps create/fetch, but its README documents neither the One Click
 * Checkout fields nor `GET /orders/{id}/extended`, both of which this needs and
 * both of which are confirmed working against sandbox. One less dependency
 * between us and a payment.
 */
@Injectable()
export class CashfreeService {
  private readonly logger = new Logger(CashfreeService.name);

  private readonly clientId = process.env.CASHFREE_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.CASHFREE_CLIENT_SECRET ?? '';

  /**
   * Sandbox unless told otherwise.
   *
   * The safe direction to fail: a misconfigured environment takes test money,
   * it does not take real money.
   */
  private readonly baseUrl =
    process.env.CASHFREE_ENV === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

  /**
   * Pinned, not floating.
   *
   * Cashfree versions its API by date and changes response shapes between
   * versions. Tracking "latest" means a field can move under us on a Tuesday.
   */
  private readonly apiVersion = '2023-08-01';

  constructor() {
    if (!this.clientId || !this.clientSecret) {
      // Not fatal at boot: the flag may be off and Razorpay may be carrying
      // checkout. It becomes fatal at the point of use, below.
      this.logger.warn('Cashfree credentials are not set. Checkout via Cashfree will fail.');
      return;
    }

    const live = this.baseUrl.startsWith('https://api.');
    if (live && this.clientId.startsWith('TEST')) {
      throw new Error(
        'CASHFREE_ENV is production but the client id is a TEST key. Refusing to start: ' +
          'this configuration takes real orders against a sandbox account.',
      );
    }

    this.logger.log(`Cashfree initialised (${live ? 'PRODUCTION' : 'sandbox'})`);
  }

  get isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  private headers(): Record<string, string> {
    return {
      'x-api-version': this.apiVersion,
      'x-client-id': this.clientId,
      'x-client-secret': this.clientSecret,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Cashfree credentials are not configured');
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: this.headers(),
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      // Their message is the useful part; the status alone says nothing about
      // which field was wrong.
      this.logger.error(`Cashfree ${init?.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
      throw new Error(`Cashfree request failed (${res.status})`);
    }

    return JSON.parse(text) as T;
  }

  /**
   * Creates the order their checkout will collect against.
   *
   * `cart_details` is what the customer sees in the summary, so the numbers
   * have to be the ones we charge. `item_original_unit_price` above
   * `item_discounted_unit_price` renders as a struck-through price and a
   * "Cart Discount" line — a difference invented here would be a discount we
   * never gave.
   *
   * Cashfree logs the customer in, offers their saved addresses, and hands the
   * chosen one back through `getOrderExtended`. `preferTheirAddress` decides
   * whether that answer replaces the one taken at our own step — it cannot
   * decide whether they ask, because their checkout breaks if they do not.
   */
  async createOrder(params: {
    orderId: string;
    amount: number;
    customerId: string;
    customerPhone: string;
    customerEmail?: string;
    customerName?: string;
    returnUrl: string;
    notifyUrl?: string;
    cartItems: CashfreeCartItem[];
    preferTheirAddress: boolean;
  }): Promise<CashfreeOrder> {
    /*
     * checkoutCollectAddress is not optional, whatever the parameter suggests.
     *
     * With `checkoutAuthenticate` alone their checkout renders a blank panel
     * and throws `RangeError: Invalid currency code :` from inside their own
     * bundle — a NumberFormat built with an empty currency. Bisected against
     * sandbox: the same order with both features renders correctly, and with
     * authenticate alone it does not. Their documentation says nothing about
     * the pairing.
     *
     * So One Click Checkout always collects the address, and the caller's
     * choice is only whether we then keep ours or theirs.
     */
    const features = ['checkoutAuthenticate', 'checkoutCollectAddress'];

    return this.request<CashfreeOrder>('/orders', {
      method: 'POST',
      body: {
        order_id: params.orderId,
        order_amount: params.amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: params.customerId,
          customer_phone: params.customerPhone,
          ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
          ...(params.customerName ? { customer_name: params.customerName } : {}),
        },
        order_meta: {
          return_url: params.returnUrl,
          ...(params.notifyUrl ? { notify_url: params.notifyUrl } : {}),
        },
        cart_details: { cart_items: params.cartItems },
        products: {
          one_click_checkout: {
            enabled: true,
            conditions: [{ action: 'ALLOW', key: 'features', values: features }],
          },
        },
      },
    });
  }

  /** The order as they hold it. Status here is authoritative, ours is a copy. */
  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/orders/${encodeURIComponent(orderId)}`);
  }

  /**
   * The One Click Checkout half: the address the customer picked, and any offer
   * their checkout applied.
   *
   * Confirmed against sandbox — it is not in the Node SDK's documented surface,
   * which is one reason this service talks to the API directly.
   */
  async getOrderExtended(orderId: string): Promise<{
    customer_details?: CashfreeCustomerDetails | null;
    shipping_address?: CashfreeAddress | null;
    billing_address?: CashfreeAddress | null;
    cart?: Record<string, unknown>;
    /** What they actually charged, in rupees. Ours until an offer moves it. */
    order_amount?: number | null;
    /** Populated once an offer from their dashboard applies. Null otherwise. */
    offer?: Record<string, unknown> | null;
    /** Their own additions, which we must not charge for a second time. */
    charges?: { shipping_charges?: number | null; cod_handling_charges?: number | null } | null;
    [key: string]: unknown;
  }> {
    return this.request(`/orders/${encodeURIComponent(orderId)}/extended`);
  }

  /**
   * Verifies a webhook.
   *
   * base64( HMAC-SHA256( timestamp + rawBody, clientSecret ) ).
   *
   * The body must be the bytes as received. A digest over a re-serialised
   * object differs by key order and whitespace, and then every webhook fails —
   * which is exactly the trap the Shiprocket integration fell into.
   */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    timestamp: string,
  ): boolean {
    // No secret, no signature, or no timestamp means there is no way to tell a
    // real event from a forged one. Rejecting is the only safe answer.
    if (!this.clientSecret || !signature || !timestamp) return false;

    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const expected = crypto
      .createHmac('sha256', this.clientSecret)
      .update(timestamp + body)
      .digest('base64');

    return safeEqual(expected, signature);
  }

  /**
   * Pulls the fields we keep out of a webhook's payment entity.
   *
   * No scaling: Cashfree reports rupees and this codebase stores rupees.
   */
  readPaymentEntity(entity: Record<string, unknown>): GatewayPayment {
    const str = (k: string): string | null =>
      typeof entity[k] === 'string' ? (entity[k] as string) : null;

    const amount = entity.payment_amount;

    return {
      paymentId: String(entity.cf_payment_id ?? ''),
      gatewayOrderId: str('order_id'),
      amount: typeof amount === 'number' ? amount : Number(amount ?? 0),
      status: str('payment_status') ?? 'unknown',
      method:
        typeof entity.payment_group === 'string' ? (entity.payment_group as string) : null,
      failureReason: str('payment_message') ?? str('error_details'),
    };
  }
}
