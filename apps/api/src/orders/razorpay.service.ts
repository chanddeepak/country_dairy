import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

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
  private isMockMode = true;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret && !keyId.startsWith('rzp_mock')) {
      try {
        const Razorpay = require('razorpay');
        this.razorpayClient = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        this.isMockMode = false;
        this.logger.log('Razorpay SDK initialized in Live/Sandbox mode');
      } catch (err) {
        this.logger.error('Failed to initialize Razorpay SDK. Falling back to Mock Mode.', err.stack);
      }
    } else {
      this.logger.log('Razorpay credentials missing or set to mock. Running in Mock Payment Mode.');
    }
  }

  async createOrder(amountInPaise: number, receiptId: string): Promise<{ id: string; amount: number; currency: string }> {
    this.logger.log(`Creating payment order for: amount=${amountInPaise} paise, receipt=${receiptId}`);
    
    if (this.isMockMode) {
      const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 15)}`;
      this.logger.log(`[Mock Razorpay] Generated mock order ID: ${mockOrderId}`);
      return {
        id: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
      };
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

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    this.logger.log(`Verifying payment signature: order=${orderId}, payment=${paymentId}`);

    if (this.isMockMode || orderId.startsWith('order_mock_')) {
      this.logger.log('[Mock Razorpay] Signature verified successfully (mock bypass)');
      return true;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const generated = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generated === signature;
  }
}
