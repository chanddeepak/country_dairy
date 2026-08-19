import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ShiprocketService } from './shiprocket.service';
import { ShiprocketAuthGuard } from './shiprocket-auth.guard';
import {
  ShiprocketOrderService,
  type ShiprocketOrderPayload,
} from './shiprocket-order.service';

/**
 * The catalogue Shiprocket pulls from us.
 *
 * Three endpoints, in their documented shape, behind their documented auth.
 * Nothing here is for our own storefront — it reads the same tables through a
 * different vocabulary, and exists so their checkout knows what we sell.
 */
@Controller('shiprocket')
@UseGuards(ShiprocketAuthGuard)
export class ShiprocketController {
  constructor(
    private readonly shiprocket: ShiprocketService,
    private readonly orders: ShiprocketOrderService,
  ) {}

  @Get('products')
  async products(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.shiprocket.listProducts(pageOf(page), limitOf(limit));
  }

  @Get('collections')
  async collections(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.shiprocket.listCollections(pageOf(page), limitOf(limit));
  }

  /**
   * Their order webhook.
   *
   * Always answers 200 once the signature is good, including for a duplicate
   * or an abandoned checkout — anything else and they keep retrying a request
   * we have deliberately declined to act on.
   *
   * A genuine failure is left to throw. That one we do want retried.
   */
  @Post('webhook/order')
  @HttpCode(200)
  async orderWebhook(@Body() body: Buffer | ShiprocketOrderPayload) {
    // express.raw hands us the bytes, which is what the guard needed to verify
    // the digest. Parsing happens here, after the signature has been checked —
    // never before, or we would be reading a stranger's JSON.
    const payload: ShiprocketOrderPayload = Buffer.isBuffer(body)
      ? JSON.parse(body.toString('utf8'))
      : body;

    const result = await this.orders.ingest(payload);
    return { ok: true, ...result };
  }

  @Get('collection-products')
  async byCollection(
    @Query('collection_id') collectionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shiprocket.listProductsByCollection(
      BigInt(collectionId || '0'),
      pageOf(page),
      limitOf(limit),
    );
  }
}

/**
 * Their examples send page=1 and page=0 for the same thing in different
 * places, so anything below 1 is treated as the first page rather than
 * producing a negative offset and an empty answer nobody can explain.
 */
function pageOf(raw?: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.floor(n) : 1;
}

/** Capped, so a stray limit=100000 cannot ask us to serialise the catalogue. */
function limitOf(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(Math.floor(n), 250);
}
