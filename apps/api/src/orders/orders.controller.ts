import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeliveryType, OrderStatus, Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import {
  CancelOrderDto,
  CheckoutDto,
  UpdateOrderStatusDto,
  VerifyPaymentDto,
} from './dto/orders.dto';

const ORDER_STAFF = [Role.SUPER_ADMIN, Role.ORDER_MANAGER] as const;

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // --- Admin routes are declared before ':id' so that "admin" is never
  // mistaken for an order id by the router. ---

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(...ORDER_STAFF)
  async getAllOrders(@Query('status') status?: OrderStatus, @Query('search') search?: string) {
    return this.ordersService.getAllOrdersAdmin({ status, search });
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(...ORDER_STAFF)
  async getStats() {
    return this.ordersService.getOrderStatsAdmin();
  }

  @Patch('admin/:id/status')
  @UseGuards(RolesGuard)
  @Roles(...ORDER_STAFF)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateOrderStatusAdmin(id, dto.status, {
      driverId: dto.driverId,
      trackingNumber: dto.trackingNumber,
      shippingCarrier: dto.shippingCarrier,
      note: dto.note,
    });
  }

  // --- Customer routes ---

  @Post('checkout')
  async checkout(@CurrentUser() user: { id: string }, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(
      user.id,
      dto.addressId,
      dto.deliveryType ?? DeliveryType.LOCAL,
      dto.couponCode,
    );
  }

  @Post('verify-payment')
  async verifyPayment(@CurrentUser() user: { id: string }, @Body() dto: VerifyPaymentDto) {
    return this.ordersService.verifyPayment(
      user.id,
      dto.orderId,
      dto.razorpayPaymentId,
      dto.signature,
    );
  }

  @Get()
  async getUserOrders(@CurrentUser() user: { id: string }) {
    return this.ordersService.getUserOrders(user.id);
  }

  @Get(':id')
  async getOrderById(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ordersService.getOrderById(user.id, id);
  }

  @Post(':id/reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ordersService.reorder(user.id, id);
  }

  @Get(':id/invoice')
  async getInvoice(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.ordersService.getInvoice(user.id, id);
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.id, id, dto.reason);
  }
}
