import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ShiprocketCheckoutService } from './shiprocket-checkout.service';
import { CreateCheckoutTokenDto } from './dto/shiprocket-checkout.dto';

/**
 * Our storefront asking us to open their checkout.
 *
 * Separate from ShiprocketController on purpose: that one is guarded by
 * Shiprocket's own API key and HMAC, because Shiprocket calls it. This is
 * called by a customer's browser, which has neither and must never be given
 * them. Same prefix, opposite direction.
 */
@Controller('shiprocket/checkout')
export class ShiprocketCheckoutController {
  constructor(private readonly checkout: ShiprocketCheckoutService) {}

  @Post('token')
  @HttpCode(200)
  async token(@Body() body: CreateCheckoutTokenDto) {
    return this.checkout.createToken(body.items);
  }
}
