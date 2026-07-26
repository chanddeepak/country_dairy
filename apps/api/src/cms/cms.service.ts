import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

function sanitizeRelativeUrl(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes('/storage/v1/object/public/')) {
    const parts = url.split('/storage/v1/object/public/')[1];
    return parts ? `/${parts}` : url;
  }
  return url;
}

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
  ) {}

  // Hero Banners
  async getHeroBanners(deviceType?: 'DESKTOP' | 'MOBILE') {
    return this.prisma.heroBanner.findMany({
      where: deviceType ? { deviceType: deviceType as any } : undefined,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createHeroBanner(dto: any) {
    const cleanUrl = sanitizeRelativeUrl(dto.imageUrl) || '/images/hero-banner.png';
    return this.prisma.heroBanner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle || '',
        imageUrl: cleanUrl,
        deviceType: dto.deviceType || 'DESKTOP',
        ctaText: dto.ctaText || 'Order Fresh Now',
        ctaLink: dto.ctaLink || '/products',
        badgeText: dto.badgeText || 'FARM FRESH',
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateHeroBanner(id: string, dto: any) {
    const cleanUrl = sanitizeRelativeUrl(dto.imageUrl);
    const existing = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!existing) {
      this.logger.log(`HeroBanner id ${id} not found in DB. Creating new DB record...`);
      return this.prisma.heroBanner.create({
        data: {
          id: id.startsWith('slide-') ? undefined : id,
          title: dto.title || 'Hero Banner',
          subtitle: dto.subtitle || '',
          imageUrl: cleanUrl || '/images/hero-banner.png',
          deviceType: dto.deviceType || 'DESKTOP',
          ctaText: dto.ctaText || 'Shop All Products',
          ctaLink: dto.ctaLink || '/products',
          badgeText: dto.badgeText || 'FARM FRESH',
          displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
      });
    }

    // Auto-cleanup old media file if updated with a new image URL
    if (cleanUrl && existing.imageUrl && cleanUrl !== existing.imageUrl) {
      this.logger.log(`Cleaning up old banner image: ${existing.imageUrl}`);
      await this.mediaService.deleteMediaFile(existing.imageUrl);
    }

    this.logger.log(`Updating HeroBanner id ${id} in DB: title="${dto.title}", deviceType="${dto.deviceType || existing.deviceType}", imageUrl="${cleanUrl}"`);
    return this.prisma.heroBanner.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: cleanUrl,
        deviceType: dto.deviceType || undefined,
        ctaText: dto.ctaText,
        ctaLink: dto.ctaLink,
        badgeText: dto.badgeText,
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async deleteHeroBanner(id: string) {
    const existing = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (existing) {
      await this.mediaService.deleteMediaFile(existing.imageUrl);
    }
    return this.prisma.heroBanner.delete({ where: { id } });
  }

  // Trust Badges
  async getTrustBadges() {
    return this.prisma.trustBadge.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createTrustBadge(dto: any) {
    return this.prisma.trustBadge.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle || '',
        iconName: dto.iconName || 'ShieldCheck',
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateTrustBadge(id: string, dto: any) {
    return this.prisma.trustBadge.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        iconName: dto.iconName,
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async deleteTrustBadge(id: string) {
    return this.prisma.trustBadge.delete({ where: { id } });
  }

  // Feature Flags
  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleFeatureFlag(key: string) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException(`Feature flag ${key} not found`);

    return this.prisma.featureFlag.update({
      where: { key },
      data: { isEnabled: !existing.isEnabled },
    });
  }
}
