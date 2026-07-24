import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from './razorpay.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
  ) {}

  async checkout(userId: string, addressId: string, deliveryType: 'LOCAL' | 'COURIER') {
    this.logger.log(`Starting checkout checkout: userId=${userId}, addressId=${addressId}`);

    // Validate user address
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userId !== userId) {
      this.logger.warn(`Invalid checkout address: ${addressId}`);
      throw new BadRequestException('Invalid delivery address');
    }

    // Retrieve active cart items
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true,
      },
    });

    if (cartItems.length === 0) {
      this.logger.warn(`Attempted checkout with empty cart: userId=${userId}`);
      throw new BadRequestException('Cannot checkout: shopping cart is empty');
    }

    // Calculate total amount
    let subtotal = 0;
    for (const item of cartItems) {
      const price = Number((item.product as any).variants?.[0]?.sellingPrice || 100);
      subtotal += price * item.quantity;
    }

    // Delivery charges rules: free above 500 INR, else 40 INR
    const deliveryCharges = subtotal >= 500 ? 0.00 : 40.00;
    const totalAmount = subtotal + deliveryCharges;

    this.logger.log(`Checkout calculation: subtotal=${subtotal}, delivery=${deliveryCharges}, total=${totalAmount}`);

    // Create the DB Order in PENDING status
    const order = await this.prisma.order.create({
      data: {
        userId,
        addressId,
        totalAmount,
        deliveryCharges,
        deliveryType,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        orderItems: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: Number((item.product as any).variants?.[0]?.sellingPrice || 100),
          })),
        },
      },
      include: {
        orderItems: true,
      },
    });

    // Create Razorpay payment gateway order
    // Razorpay amounts are in paise (e.g. 100 paise = 1 INR)
    const amountInPaise = Math.round(totalAmount * 100);
    const gatewayOrder = await this.razorpayService.createOrder(amountInPaise, order.id);

    // Update Order with the Razorpay order ID
    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentGatewayId: gatewayOrder.id,
      },
    });

    this.logger.log(`Created order ${updatedOrder.id} successfully mapped to payment ID ${gatewayOrder.id}`);

    return {
      orderId: updatedOrder.id,
      paymentGatewayId: gatewayOrder.id,
      amount: totalAmount,
      currency: 'INR',
    };
  }

  async verifyPayment(
    userId: string,
    orderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    this.logger.log(`Verifying payment for orderId: ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      this.logger.warn(`Order ${orderId} not found or doesn't belong to user ${userId}`);
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      this.logger.warn(`Payment verification aborted: Order ${orderId} is already in state ${order.status}`);
      return order;
    }

    // Verify cryptographic signature
    const isValid = this.razorpayService.verifySignature(
      order.paymentGatewayId || '',
      razorpayPaymentId,
      signature,
    );

    if (!isValid) {
      this.logger.warn(`Invalid signature provided for payment verification: order=${orderId}`);
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
        },
      });
      throw new BadRequestException('Payment verification failed');
    }

    // Capture success
    this.logger.log(`Payment success: updating order ${orderId} to CONFIRMED`);
    const confirmedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      },
    });

    // Clear user shopping cart
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    });
    this.logger.log(`Cart cleared successfully for userId: ${userId}`);

    return confirmedOrder;
  }

  async getUserOrders(userId: string) {
    this.logger.log(`Retrieving orders for userId: ${userId}`);
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                title: true,
                slug: true,
                galleryImages: true,
              },
            },
          },
        },
        address: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
        address: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
