import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
  ) {}

  // Hero Banners
  async getHeroBanners() {
    return this.prisma.heroBanner.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createHeroBanner(dto: any) {
    return this.prisma.heroBanner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle || '',
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl || undefined,
        ctaText: dto.ctaText || 'Order Fresh Now',
        ctaLink: dto.ctaLink || '/products',
        badgeText: dto.badgeText || 'FARM FRESH',
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateHeroBanner(id: string, dto: any) {
    const existing = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!existing) {
      this.logger.log(`HeroBanner id ${id} not found in DB. Creating new DB record...`);
      return this.prisma.heroBanner.create({
        data: {
          id: id.startsWith('slide-') ? undefined : id,
          title: dto.title || 'Hero Banner',
          subtitle: dto.subtitle || '',
          imageUrl: dto.imageUrl || '/images/hero-banner.png',
          mobileImageUrl: dto.mobileImageUrl || undefined,
          ctaText: dto.ctaText || 'Shop All Products',
          ctaLink: dto.ctaLink || '/products',
          badgeText: dto.badgeText || 'FARM FRESH',
          displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
      });
    }

    // Auto-cleanup old media files if updated with a new URL
    if (dto.imageUrl && existing.imageUrl && dto.imageUrl !== existing.imageUrl) {
      this.logger.log(`Cleaning up old desktop image: ${existing.imageUrl}`);
      await this.mediaService.deleteMediaFile(existing.imageUrl);
    }
    if (dto.mobileImageUrl && existing.mobileImageUrl && dto.mobileImageUrl !== existing.mobileImageUrl) {
      this.logger.log(`Cleaning up old mobile image: ${existing.mobileImageUrl}`);
      await this.mediaService.deleteMediaFile(existing.mobileImageUrl);
    }

    this.logger.log(`Updating HeroBanner id ${id} in DB: title="${dto.title}", imageUrl="${dto.imageUrl}"`);
    return this.prisma.heroBanner.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl,
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
      await this.mediaService.deleteMediaFile(existing.mobileImageUrl);
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
