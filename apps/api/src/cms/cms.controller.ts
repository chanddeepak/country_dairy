import { Controller, Get, Post, Put, Patch, Delete, Param, Body } from '@nestjs/common';
import { CmsService } from './cms.service';

@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('hero')
  async getHeroBanners() {
    return this.cmsService.getHeroBanners();
  }

  @Post('hero')
  async createHeroBanner(@Body() body: any) {
    return this.cmsService.createHeroBanner(body);
  }

  @Put('hero/:id')
  async updateHeroBanner(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.updateHeroBanner(id, body);
  }

  @Delete('hero/:id')
  async deleteHeroBanner(@Param('id') id: string) {
    return this.cmsService.deleteHeroBanner(id);
  }

  @Get('trust-badges')
  async getTrustBadges() {
    return this.cmsService.getTrustBadges();
  }

  @Post('trust-badges')
  async createTrustBadge(@Body() body: any) {
    return this.cmsService.createTrustBadge(body);
  }

  @Put('trust-badges/:id')
  async updateTrustBadge(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.updateTrustBadge(id, body);
  }

  @Delete('trust-badges/:id')
  async deleteTrustBadge(@Param('id') id: string) {
    return this.cmsService.deleteTrustBadge(id);
  }

  @Get('feature-flags')
  async getFeatureFlags() {
    return this.cmsService.getFeatureFlags();
  }

  @Patch('feature-flags/:key/toggle')
  async toggleFeatureFlag(@Param('key') key: string) {
    return this.cmsService.toggleFeatureFlag(key);
  }
}
