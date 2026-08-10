import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Shared so the batched add path returns exactly what getCart returns. */
const CART_PRODUCT_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  forceOutOfStock: true,
  gstRate: true,
  isSubscriptionAllowed: true,
  galleryImages: true,
} as const;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        variant: true,
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            forceOutOfStock: true,
            gstRate: true,
            isSubscriptionAllowed: true,
            galleryImages: { orderBy: { displayOrder: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => this.decorate(item));
  }

  /**
   * Prices come from the variant on every read, so a cart cannot drift away
   * from the catalogue between sessions.
   */
  private decorate(item: {
    quantity: number;
    variant: { sellingPrice: unknown; stockQuantity: number; isActive: boolean };
    product: { status: string; forceOutOfStock: boolean };
  }) {
    const unitPrice = Number(item.variant.sellingPrice);
    const available = this.availableStock(item);

    return {
      ...item,
      unitPrice,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
      availableStock: available,
      isAvailable: available >= item.quantity,
    };
  }

  private availableStock(item: {
    variant: { stockQuantity: number; isActive: boolean };
    product: { status: string; forceOutOfStock: boolean };
  }): number {
    if (
      item.product.status !== 'LIVE' ||
      item.product.forceOutOfStock ||
      !item.variant.isActive
    ) {
      return 0;
    }
    return item.variant.stockQuantity;
  }

  /**
   * Returns the whole updated cart, not just the new line.
   *
   * Every query here is a round trip to a remote pooler at roughly 700ms, so
   * the count matters more than the work. The two reads are batched into one
   * transaction, and returning the cart saves the client the follow-up GET it
   * used to make — four round trips down to two.
   */
  /**
   * Returns the whole updated cart, not just the new line.
   *
   * Every database round trip costs the network latency to the pooler, so the
   * count is the whole cost. Two independent reads run in parallel — measured
   * at the price of one — and the response is assembled in memory from what
   * we already fetched, which avoids re-reading the cart after the write.
   *
   * Four round trips (two requests) down to two.
   */
  async addToCart(userId: string, variantId: string, quantity: number) {
    const [variant, currentItems] = await Promise.all([
      this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: { select: CART_PRODUCT_SELECT } },
      }),
      this.prisma.cartItem.findMany({
        where: { userId },
        include: { variant: true, product: { select: CART_PRODUCT_SELECT } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!variant || !variant.isActive) {
      throw new NotFoundException('This product option is not available');
    }

    if (variant.product.status !== 'LIVE' || variant.product.forceOutOfStock) {
      throw new BadRequestException('This product is not currently available');
    }

    const existing = currentItems.find((i) => i.variantId === variantId);
    const desiredQuantity = (existing?.quantity ?? 0) + quantity;

    if (desiredQuantity > variant.stockQuantity) {
      throw new BadRequestException(
        variant.stockQuantity === 0
          ? 'This option is out of stock'
          : `Only ${variant.stockQuantity} left in stock`,
      );
    }

    const saved = await this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId, variantId } },
      update: { quantity: desiredQuantity },
      create: { userId, productId: variant.product.id, variantId, quantity },
    });

    // Merge the change into the list already in hand rather than re-reading it.
    const nextItems = existing
      ? currentItems.map((i) =>
          i.variantId === variantId ? { ...i, quantity: desiredQuantity } : i,
        )
      : [...currentItems, { ...saved, variant, product: variant.product }];

    return nextItems.map((item) => this.decorate(item as never));
  }

  async updateCartItem(userId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { variant: true },
    });

    if (!item || item.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
      return this.getCart(userId);
    }

    if (quantity > item.variant.stockQuantity) {
      throw new BadRequestException(`Only ${item.variant.stockQuantity} left in stock`);
    }

    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeFromCart(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });

    if (!item || item.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }
}
