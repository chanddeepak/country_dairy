import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateSubscriptionDto, TriggerSchedulerDto } from './dto/subscriptions.dto';

@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  async createSubscription(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.createSubscription(
      user.id,
      dto.variantId,
      dto.quantity,
      dto.frequency,
      dto.daysOfWeek ?? [],
      dto.startDate,
    );
  }

  @Put(':id/pause')
  async pauseSubscription(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.subscriptionsService.pauseSubscription(user.id, id);
  }

  @Put(':id/resume')
  async resumeSubscription(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.subscriptionsService.resumeSubscription(user.id, id);
  }

  @Get()
  async getUserSubscriptions(@CurrentUser() user: { id: string }) {
    return this.subscriptionsService.getUserSubscriptions(user.id);
  }

  /**
   * Runs the billing scheduler. Restricted to super admin — it debits customer
   * wallets, and was previously callable by any signed-in customer.
   */
  @Post('trigger-scheduler')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async triggerScheduler(@Body() dto: TriggerSchedulerDto) {
    return this.subscriptionsService.processDailySubscriptions(dto.date);
  }
}
