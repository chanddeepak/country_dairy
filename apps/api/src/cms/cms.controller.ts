import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CmsService } from './cms.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { HeroBannerDto, TrustBadgeDto, WhatsAppConfigDto } from './dto/cms.dto';

const CMS_STAFF = [Role.SUPER_ADMIN, Role.CATALOG_MANAGER] as const;

@Controller('cms')
export class CmsController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  // --- Public storefront reads ---

  @Get('hero')
  async getHeroBanners(@Query('deviceType') deviceType?: 'DESKTOP' | 'MOBILE') {
    return this.cmsService.getHeroBanners(deviceType);
  }

  @Get('trust-badges')
  async getTrustBadges() {
    return this.cmsService.getTrustBadges();
  }

  @Get('feature-flags')
  async getFeatureFlags() {
    return this.cmsService.getFeatureFlags();
  }

  /**
   * Flat { KEY: boolean } map for storefront clients, so the web and mobile
   * apps can read flags from the database instead of hardcoding them.
   */
  @Get('feature-flags/map')
  async getFeatureFlagMap() {
    return this.featureFlags.getAll();
  }

  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    return this.cmsService.getSetting(key);
  }

  /** Public: the storefront reads the number and templates from here. */
  @Get('whatsapp')
  async getWhatsAppConfig() {
    return this.cmsService.getWhatsAppConfig();
  }

  @Put('whatsapp')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async setWhatsAppConfig(
    @CurrentUser() user: { id: string },
    @Body() dto: WhatsAppConfigDto,
  ) {
    return this.cmsService.setWhatsAppConfig(
      {
        isEnabled: dto.isEnabled,
        phoneNumber: dto.phoneNumber,
        messageTemplate: dto.messageTemplate,
        cartMessageTemplate: dto.cartMessageTemplate ?? dto.messageTemplate,
      },
      user.id,
    );
  }

  // --- Admin CMS management ---

  @Post('hero')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async createHeroBanner(@Body() body: HeroBannerDto) {
    return this.cmsService.createHeroBanner(body);
  }

  @Put('hero/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async updateHeroBanner(@Param('id') id: string, @Body() body: HeroBannerDto) {
    return this.cmsService.updateHeroBanner(id, body);
  }

  @Delete('hero/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async deleteHeroBanner(@Param('id') id: string) {
    return this.cmsService.deleteHeroBanner(id);
  }

  @Post('trust-badges')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async createTrustBadge(@Body() body: TrustBadgeDto) {
    return this.cmsService.createTrustBadge(body);
  }

  @Put('trust-badges/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async updateTrustBadge(@Param('id') id: string, @Body() body: TrustBadgeDto) {
    return this.cmsService.updateTrustBadge(id, body);
  }

  @Delete('trust-badges/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async deleteTrustBadge(@Param('id') id: string) {
    return this.cmsService.deleteTrustBadge(id);
  }

  @Patch('feature-flags/:key/toggle')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async toggleFeatureFlag(@Param('key') key: string) {
    const updated = await this.cmsService.toggleFeatureFlag(key);
    this.featureFlags.invalidate();
    return updated;
  }

  @Put('settings/:key')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CMS_STAFF)
  async setSetting(
    @Param('key') key: string,
    @Body() body: { value: unknown; description?: string },
  ) {
    return this.cmsService.setSetting(key, body.value, body.description);
  }
}
