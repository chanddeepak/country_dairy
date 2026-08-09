import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Public ingest. Unauthenticated by design — most storefront traffic is
   * anonymous, and the service only accepts a known set of event names.
   */
  @Post('track')
  @HttpCode(HttpStatus.ACCEPTED)
  async track(@Body() dto: TrackEventDto) {
    return this.analyticsService.track(dto);
  }

  @Get('dashboard')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORDER_MANAGER, Role.CATALOG_MANAGER)
  async dashboard(@Query('days') days?: string) {
    const parsed = Number(days);
    const window = Number.isFinite(parsed) && parsed > 0 && parsed <= 90 ? parsed : 7;
    return this.analyticsService.getDashboard(window);
  }

  @Get('stock-alerts')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CATALOG_MANAGER, Role.ORDER_MANAGER)
  async stockAlerts() {
    return this.analyticsService.getStockAlerts();
  }
}
