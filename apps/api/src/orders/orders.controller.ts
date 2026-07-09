import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  async checkout(
    @CurrentUser() user: any,
    @Body('addressId') addressId: string,
    @Body('deliveryType') deliveryType: 'LOCAL' | 'COURIER',
  ) {
    return this.ordersService.checkout(user.id, addressId, deliveryType);
  }

  @Post('verify-payment')
  async verifyPayment(
    @CurrentUser() user: any,
    @Body('orderId') orderId: string,
    @Body('razorpayPaymentId') razorpayPaymentId: string,
    @Body('signature') signature: string,
  ) {
    return this.ordersService.verifyPayment(user.id, orderId, razorpayPaymentId, signature);
  }

  @Get()
  async getUserOrders(@CurrentUser() user: any) {
    return this.ordersService.getUserOrders(user.id);
  }

  @Get(':id')
  async getOrderById(@CurrentUser() user: any, @Param('id') orderId: string) {
    return this.ordersService.getOrderById(user.id, orderId);
  }
}
