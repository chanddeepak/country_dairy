import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';

/**
 * Deliberately its own controller with no AuthGuard.
 *
 * A gateway cannot present a JWT — the HMAC over the raw body is the
 * authentication, and it is checked before anything in the payload is read or
 * trusted. Adding this route to OrdersController would inherit that class's
 * AuthGuard and every real webhook would 401.
 */
@Controller('orders/webhook')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post('razorpay')
  // 200 rather than 201: the gateway retries on any non-2xx, and a 201 for an
  // event we merely acknowledged reads as if we created something.
  @HttpCode(200)
  async razorpay(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    // express.raw is mounted on this path in main.ts, so req.body is a Buffer
    // of the exact bytes the gateway signed.
    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body ?? {});

    return this.webhooks.handleRazorpay(rawBody, signature);
  }

  @Post('cashfree')
  @HttpCode(200)
  async cashfree(
    @Req() req: Request,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
  ) {
    // Same raw-body mount as the route above. Cashfree signs the timestamp
    // header together with these exact bytes, so both travel to the verifier
    // untouched.
    const rawBody: Buffer | string = Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body ?? {});

    return this.webhooks.handleCashfree(rawBody, signature, timestamp);
  }
}
