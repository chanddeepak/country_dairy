import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    // Prices come from the variant on every read, so the cart cannot drift
    // away from the catalog between sessions.
    return items.map((item) => {
      const unitPrice = Number(item.variant.sellingPrice);
      const available = this.availableStock(item);

      return {
        ...item,
        unitPrice,
        lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
        availableStock: available,
        isAvailable: available >= item.quantity,
      };
    });
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

  async addToCart(userId: string, variantId: string, quantity: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { id: true, status: true, forceOutOfStock: true } } },
    });

    if (!variant || !variant.isActive) {
      throw new NotFoundException('This product option is not available');
    }

    if (variant.product.status !== 'LIVE' || variant.product.forceOutOfStock) {
      throw new BadRequestException('This product is not currently available');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_variantId: { userId, variantId } },
    });

    const desiredQuantity = (existing?.quantity ?? 0) + quantity;

    if (desiredQuantity > variant.stockQuantity) {
      throw new BadRequestException(
        variant.stockQuantity === 0
          ? 'This option is out of stock'
          : `Only ${variant.stockQuantity} left in stock`,
      );
    }

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: desiredQuantity },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        userId,
        productId: variant.product.id,
        variantId,
        quantity,
      },
    });
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
      return { success: true, removed: true };
    }

    if (quantity > item.variant.stockQuantity) {
      throw new BadRequestException(`Only ${item.variant.stockQuantity} left in stock`);
    }

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  async removeFromCart(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });

    if (!item || item.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { success: true };
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }
}
