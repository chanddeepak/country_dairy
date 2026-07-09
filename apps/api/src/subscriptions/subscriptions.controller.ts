import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  async createSubscription(
    @CurrentUser() user: any,
    @Body('productId') productId: string,
    @Body('quantity') quantity: number,
    @Body('frequency') frequency: string,
    @Body('daysOfWeek') daysOfWeek: number[],
    @Body('startDate') startDate: string,
  ) {
    return this.subscriptionsService.createSubscription(
      user.id,
      productId,
      Number(quantity),
      frequency,
      daysOfWeek,
      startDate,
    );
  }

  @Put(':id/pause')
  async pauseSubscription(@CurrentUser() user: any, @Param('id') id: string) {
    return this.subscriptionsService.pauseSubscription(user.id, id);
  }

  @Put(':id/resume')
  async resumeSubscription(@CurrentUser() user: any, @Param('id') id: string) {
    return this.subscriptionsService.resumeSubscription(user.id, id);
  }

  @Get()
  async getUserSubscriptions(@CurrentUser() user: any) {
    return this.subscriptionsService.getUserSubscriptions(user.id);
  }

  // Developer-only endpoint to verify delivery trigger flows locally
  @Post('trigger-scheduler')
  async triggerScheduler(@Body('date') dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.subscriptionsService.processDailyDeliveries(date);
  }
}
