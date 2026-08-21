import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService, FLAG } from '../feature-flags/feature-flags.service';
import { ShiprocketClient, type CartItem } from './shiprocket-client.service';

export interface RequestedLine {
  variantId: string;
  quantity: number;
}

/**
 * Where their checkout returns the customer.
 *
 * Built here, never accepted from the browser. The token is signed with our
 * secret, so a redirect the caller chose would be a signed instruction to send
 * our customers wherever they liked — an open redirect wearing our signature.
 */
function storefrontOrigin(): string {
  const configured = process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim();
  return configured || 'http://localhost:3000';
}

/**
 * Handing a basket to Shiprocket's checkout.
 *
 * The browser sends what it wants to buy; this decides whether that is a real
 * thing we sell. Their window prices the order from the catalogue they pulled
 * from us, so a line we pass without checking is a line they will happily
 * charge for — the validation here is the only place that can refuse.
 */
@Injectable()
export class ShiprocketCheckoutService {
  private readonly logger = new Logger(ShiprocketCheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private flags: FeatureFlagsService,
    private client: ShiprocketClient,
  ) {}

  async createToken(lines: RequestedLine[]) {
    if (!(await this.flags.isEnabled(FLAG.SHIPROCKET_CHECKOUT))) {
      // Off is a 404, not a 403: an unreleased checkout should not announce
      // itself to anyone poking at the API.
      throw new NotFoundException();
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('There is nothing in that basket');
    }

    const ids = lines.map((l) => l.variantId);

    // Live products only, active sizes only. Their catalogue sync runs on a
    // schedule, so it can still be offering something we withdrew an hour ago;
    // this is the check that stops a customer buying it.
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        product: { status: ProductStatus.LIVE },
      },
      select: { id: true, externalId: true, stockQuantity: true, sizeLabel: true },
    });

    // Our id in, their id out. The translation happens here and nowhere else.
    const known = new Map(variants.map((v) => [v.id, v]));

    const items: CartItem[] = [];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException('That quantity is not a number we can sell');
      }

      const variant = known.get(line.variantId);
      if (!variant) {
        throw new BadRequestException('One of those items is no longer on sale');
      }

      // Their checkout has no idea what our stock is beyond the last sync, so
      // a sold-out size has to be refused here or it is sold twice.
      if (variant.stockQuantity < quantity) {
        throw new BadRequestException(
          `${variant.sizeLabel ?? 'That size'} has only ${variant.stockQuantity} left`,
        );
      }

      items.push({ variant_id: variant.externalId.toString(), quantity });
    }

    const result = await this.client.createCheckoutToken(
      items,
      `${storefrontOrigin()}/checkout/shiprocket-return`,
    );
    this.logger.log(`Shiprocket checkout opened for ${items.length} line(s)`);

    // The token only. `order_id` is theirs and means nothing to a browser; the
    // order that matters arrives on the webhook, signed.
    return { token: result.token };
  }
}
