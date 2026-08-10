import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { DeliveryService } from './delivery.service';
import {
  AssignRouteDto,
  FailedAttemptDto,
  MarkDeliveredDto,
  RouteQueryDto,
} from './dto/delivery.dto';

const DISPATCH_STAFF = [Role.SUPER_ADMIN, Role.ORDER_MANAGER] as const;

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  // --- Dispatch desk ---

  @Get('routes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...DISPATCH_STAFF)
  async getRoutes(@Query() query: RouteQueryDto) {
    return this.delivery.getRouteSheets(query.date);
  }

  @Post('routes/assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...DISPATCH_STAFF)
  async assignRoute(@Body() dto: AssignRouteDto) {
    return this.delivery.assignRoute(dto.orderIds, dto.driverId);
  }

  // --- Driver ---
  //
  // Every route below takes the driver id from the verified token, never from
  // the request, so a driver cannot read or complete another driver's round by
  // passing a different id.

  @Get('my-deliveries')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.DELIVERY_DRIVER, Role.SUPER_ADMIN)
  async getMyDeliveries(@CurrentUser() user: { id: string }) {
    return this.delivery.getMyDeliveries(user.id);
  }

  @Get('my-deliveries/completed')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.DELIVERY_DRIVER, Role.SUPER_ADMIN)
  async getMyCompleted(@CurrentUser() user: { id: string }) {
    return this.delivery.getMyCompletedToday(user.id);
  }

  @Patch(':orderId/delivered')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.DELIVERY_DRIVER, Role.SUPER_ADMIN)
  async markDelivered(
    @CurrentUser() user: { id: string },
    @Param('orderId') orderId: string,
    @Body() dto: MarkDeliveredDto,
  ) {
    return this.delivery.markDelivered(orderId, user.id, dto.note);
  }

  @Patch(':orderId/failed')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.DELIVERY_DRIVER, Role.SUPER_ADMIN)
  async markFailed(
    @CurrentUser() user: { id: string },
    @Param('orderId') orderId: string,
    @Body() dto: FailedAttemptDto,
  ) {
    return this.delivery.markAttemptFailed(orderId, user.id, dto.reason);
  }
}
