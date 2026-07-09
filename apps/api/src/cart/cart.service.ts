import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    this.logger.log(`Fetching shopping cart for userId: ${userId}`);
    try {
      return await this.prisma.cartItem.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              imageUrls: true,
              isSubscriptionAllowed: true,
              stock: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch cart for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async addToCart(userId: string, productId: string, quantity: number) {
    this.logger.log(`Adding to cart: userId=${userId}, productId=${productId}, qty=${quantity}`);
    try {
      // Validate product existence
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        this.logger.warn(`Failed to add to cart: Product ${productId} not found`);
        throw new NotFoundException(`Product not found`);
      }

      // Check if item is already in cart
      const existing = await this.prisma.cartItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });

      if (existing) {
        // Update quantity
        const newQty = existing.quantity + quantity;
        this.logger.log(`Updating quantity for existing cart item to: ${newQty}`);
        return await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      }

      // Create new cart item
      return await this.prisma.cartItem.create({
        data: {
          userId,
          productId,
          quantity,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to add product to cart: userId=${userId}, productId=${productId}`, error.stack);
      throw error;
    }
  }

  async updateCartItem(userId: string, itemId: string, quantity: number) {
    this.logger.log(`Updating cart item: userId=${userId}, itemId=${itemId}, quantity=${quantity}`);
    try {
      const item = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
      });

      if (!item || item.userId !== userId) {
        this.logger.warn(`Cart item ${itemId} not found or doesn't belong to user ${userId}`);
        throw new NotFoundException('Cart item not found');
      }

      if (quantity <= 0) {
        this.logger.log(`Quantity is 0 or less. Removing item ${itemId} from cart`);
        await this.prisma.cartItem.delete({
          where: { id: itemId },
        });
        return { success: true, removed: true };
      }

      return await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to update cart item: itemId=${itemId}`, error.stack);
      throw error;
    }
  }

  async removeFromCart(userId: string, itemId: string) {
    this.logger.log(`Removing cart item: userId=${userId}, itemId=${itemId}`);
    try {
      const item = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
      });

      if (!item || item.userId !== userId) {
        this.logger.warn(`Cart item ${itemId} not found or doesn't belong to user ${userId}`);
        throw new NotFoundException('Cart item not found');
      }

      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to remove cart item: itemId=${itemId}`, error.stack);
      throw error;
    }
  }
}
