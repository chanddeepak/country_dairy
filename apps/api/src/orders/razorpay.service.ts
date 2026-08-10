import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/** What the gateway tells us about a payment, normalised. */
export interface GatewayPayment {
  paymentId: string;
  gatewayOrderId: string | null;
  /** Rupees. The gateway reports paise. */
  amount: number;
  status: string;
  method: string | null;
  failureReason: string | null;
}

/**
 * Constant-time string comparison.
 *
 * `a === b` on a signature leaks how many leading bytes matched through timing,
 * which is enough to forge one byte at a time.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal, so equalise first.
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  /**
   * The razorpay package ships no types, so this is the minimum surface we
   * use rather than an unchecked any.
   */
  private razorpayClient: {
    orders: {
      create(opts: Record<string, unknown>): Promise<{
        id: string;
        amount: number;
        currency: string;
      }>;
    };
  } | null = null;

  private mockMode = true;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (keyId && keySecret && !keyId.startsWith('rzp_mock')) {
      try {
        const Razorpay = require('razorpay');
        this.razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
        this.mockMode = false;
        this.logger.log(`Razorpay initialised (${keyId.startsWith('rzp_live') ? 'LIVE' : 'test'} keys)`);
      } catch (err) {
        // In production this must not degrade to a mode that accepts every
        // signature — that would let anyone mark any order paid.
        if (isProduction) {
          throw new Error(
            `Razorpay SDK failed to initialise in production: ${(err as Error).message}`,
          );
        }
        this.logger.error('Razorpay SDK failed to initialise. Falling back to mock mode.');
      }
    }

    if (this.mockMode) {
      // The mock verifier returns true for any signature. Reaching production
      // in that state means a forged callback settles an unpaid order.
      if (isProduction) {
        throw new Error(
          'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set to live credentials in production. ' +
            'Mock mode accepts any payment signature and must never run against real customers.',
        );
      }
      this.logger.warn('Razorpay in MOCK MODE — signatures are not verified, no money moves.');
    }

    if (!this.mockMode && !process.env.RAZORPAY_WEBHOOK_SECRET) {
      this.logger.warn(
        'RAZORPAY_WEBHOOK_SECRET is not set. Webhooks will be rejected, so a customer who ' +
          'closes the browser after paying will leave the order unconfirmed.',
      );
    }
  }

  get isMockMode(): boolean {
    return this.mockMode;
  }

  get isWebhookConfigured(): boolean {
    return !!process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  async createOrder(
    amountInPaise: number,
    receiptId: string,
  ): Promise<{ id: string; amount: number; currency: string }> {
    this.logger.log(`Creating payment order: ${amountInPaise} paise, receipt ${receiptId}`);

    if (this.mockMode) {
      const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 15)}`;
      this.logger.log(`[Mock Razorpay] order ${mockOrderId}`);
      return { id: mockOrderId, amount: amountInPaise, currency: 'INR' };
    }

    if (!this.razorpayClient) {
      throw new Error('Razorpay client is not initialised');
    }

    return this.razorpayClient.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
    });
  }

  /** Verifies the checkout callback: HMAC over `orderId|paymentId`. */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (this.mockMode || orderId.startsWith('order_mock_')) {
      this.logger.log('[Mock Razorpay] signature bypassed');
      return true;
    }

    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return safeEqual(expected, signature);
  }

  /**
   * Verifies a webhook: HMAC over the exact raw body.
   *
   * Signed over the bytes as received, so this must not be handed a
   * re-serialised object — key order and whitespace would differ and every
   * webhook would fail.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // No secret means no way to tell a real event from a forged one. Rejecting
    // is the only safe answer; accepting would let anyone mark orders paid.
    if (!secret || !signature) return false;

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  /** Pulls the fields we care about out of a webhook payment entity. */
  readPaymentEntity(entity: Record<string, unknown>): GatewayPayment {
    const str = (k: string): string | null => (typeof entity[k] === 'string' ? (entity[k] as string) : null);

    return {
      paymentId: str('id') ?? '',
      gatewayOrderId: str('order_id'),
      // Razorpay reports paise; every amount in this codebase is rupees.
      amount: typeof entity.amount === 'number' ? entity.amount / 100 : 0,
      status: str('status') ?? 'unknown',
      method: str('method'),
      failureReason: str('error_description') ?? str('error_reason'),
    };
  }
}
