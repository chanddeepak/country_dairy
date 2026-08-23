import { parseHeroLayout } from '@country-dairy/types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BannerType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AuditService } from '../audit/audit.service';
import { HeroBannerDto, TrustBadgeDto } from './dto/cms.dto';

export const SETTING_KEYS = {
  WHATSAPP: 'whatsapp_ordering',
  SELLER: 'seller_identity',
} as const;

/**
 * What has to appear on a GST tax invoice besides the line items: the
 * supplier's legal name, registered address, GSTIN, and the state whose code
 * decides whether tax splits into CGST+SGST or is charged as IGST.
 *
 * A dairy also carries its FSSAI licence number on the invoice.
 */
export interface SellerIdentity {
  legalName: string;
  tradeName: string;
  gstin: string;
  fssaiLicence: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  /// Two-digit GST state code. Uttarakhand is 05.
  stateCode: string;
  postalCode: string;
  phone: string;
  email: string;
  /// Prefix for the invoice series, e.g. CD/2026-27/0001.
  invoicePrefix: string;
}

export const DEFAULT_SELLER: SellerIdentity = {
  legalName: 'Country Dairy',
  tradeName: 'Country Dairy',
  gstin: '',
  fssaiLicence: '',
  addressLine1: 'Tanakpur',
  addressLine2: '',
  city: 'Champawat',
  state: 'Uttarakhand',
  stateCode: '05',
  postalCode: '262309',
  phone: '+91 99978 01112',
  email: 'info@countrydairy.in',
  invoicePrefix: 'CD',
};

export interface WhatsAppConfig {
  isEnabled: boolean;
  phoneNumber: string;
  messageTemplate: string;
  cartMessageTemplate: string;
}

/**
 * Used until staff save their own. Placeholders are substituted client-side:
 * {quantity} {product_name} {variant} {price} {total_amount} {items}
 */
export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  isEnabled: true,
  phoneNumber: '919997801112',
  messageTemplate:
    "Hi Country Dairy! I'd like to order:\n" +
    '- {quantity} x {product_name} ({variant}) — ₹{price} each\n' +
    'Total: ₹{total_amount}\n\n' +
    'Please confirm my order and share the delivery timing. Thank you!',
  cartMessageTemplate:
    "Hi Country Dairy! I'd like to order:\n" +
    '{items}\n' +
    'Total: ₹{total_amount}\n\n' +
    'Please confirm my order and share the delivery timing. Thank you!',
};
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
    private audit: AuditService,
  ) {}

  // Hero Banners
  async getHeroBanners(deviceType?: 'DESKTOP' | 'MOBILE') {
    return this.prisma.heroBanner.findMany({
      where: deviceType ? { deviceType: deviceType as BannerType } : undefined,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createHeroBanner(dto: HeroBannerDto) {
    const cleanUrl = sanitizeRelativeUrl(dto.imageUrl) || '/images/hero-banner.png';
    return this.prisma.heroBanner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle || '',
        imageUrl: cleanUrl,
        imageHasText: dto.imageHasText ?? false,
        deviceType: (dto.deviceType || 'DESKTOP') as BannerType,
        ctaText: dto.ctaText || 'Order Fresh Now',
        ctaLink: dto.ctaLink || '/products',
        badgeText: dto.badgeText || 'FARM FRESH',
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        // Normalised on the way in, so nothing outside the editor's scales can
        // be stored — a hand-rolled request cannot hand the storefront an
        // anchor it has no rule for.
        layout: dto.layout ? (parseHeroLayout(dto.layout) as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async updateHeroBanner(id: string, dto: HeroBannerDto) {
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
          imageHasText: dto.imageHasText ?? false,
          deviceType: (dto.deviceType || 'DESKTOP') as BannerType,
          ctaText: dto.ctaText || 'Shop All Products',
          ctaLink: dto.ctaLink || '/products',
          badgeText: dto.badgeText || 'FARM FRESH',
          displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
  layout: dto.layout ? (parseHeroLayout(dto.layout) as unknown as Prisma.InputJsonValue) : undefined,
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
        layout: dto.layout ? (parseHeroLayout(dto.layout) as unknown as Prisma.InputJsonValue) : undefined,
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: cleanUrl,
        imageHasText: dto.imageHasText,
        deviceType: (dto.deviceType || undefined) as BannerType | undefined,
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

  async createTrustBadge(dto: TrustBadgeDto) {
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

  async updateTrustBadge(id: string, dto: TrustBadgeDto) {
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

    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { isEnabled: !existing.isEnabled },
    });

    // Flags change what customers can do, so a toggle is worth recording.
    await this.audit.record({
      action: 'TOGGLE',
      entity: 'FeatureFlag',
      entityId: key,
      before: { isEnabled: existing.isEnabled },
      after: { isEnabled: updated.isEnabled },
    });

    return updated;
  }

  // Store settings — key/value so new knobs (WhatsApp number, order message
  // template, support hours) do not each need a migration.
  async getSetting(key: string) {
    const setting = await this.prisma.storeSetting.findUnique({ where: { key } });
    return setting ?? { key, value: null };
  }

  // --- WhatsApp ordering ---

  async getSellerIdentity(): Promise<SellerIdentity> {
    const row = await this.prisma.storeSetting.findUnique({
      where: { key: SETTING_KEYS.SELLER },
    });

    if (!row) return DEFAULT_SELLER;
    return { ...DEFAULT_SELLER, ...(row.value as Partial<SellerIdentity>) };
  }

  async setSellerIdentity(config: SellerIdentity, updatedBy?: string) {
    const saved = await this.prisma.storeSetting.upsert({
      where: { key: SETTING_KEYS.SELLER },
      create: {
        key: SETTING_KEYS.SELLER,
        value: config as unknown as Prisma.InputJsonValue,
        description: 'Legal identity printed on tax invoices',
      },
      update: { value: config as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'StoreSetting',
      entityId: SETTING_KEYS.SELLER,
      after: { gstin: config.gstin, legalName: config.legalName },
    });

    this.logger.log(`Seller identity updated by ${updatedBy ?? 'system'}`);
    return saved.value;
  }

  async getWhatsAppConfig(): Promise<WhatsAppConfig> {
    const setting = await this.prisma.storeSetting.findUnique({
      where: { key: SETTING_KEYS.WHATSAPP },
    });

    return { ...DEFAULT_WHATSAPP_CONFIG, ...((setting?.value as Partial<WhatsAppConfig>) ?? {}) };
  }

  async setWhatsAppConfig(config: WhatsAppConfig, updatedBy?: string) {
    const saved = await this.prisma.storeSetting.upsert({
      where: { key: SETTING_KEYS.WHATSAPP },
      update: { value: config as unknown as Prisma.InputJsonValue, updatedBy },
      create: {
        key: SETTING_KEYS.WHATSAPP,
        value: config as unknown as Prisma.InputJsonValue,
        description: 'WhatsApp ordering number and message templates',
        updatedBy,
      },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'StoreSetting',
      entityId: SETTING_KEYS.WHATSAPP,
      after: { phoneNumber: config.phoneNumber, isEnabled: config.isEnabled },
    });

    this.logger.log(`WhatsApp config updated by ${updatedBy ?? 'system'}`);
    return saved.value;
  }

  async setSetting(key: string, value: unknown, description?: string) {
    return this.prisma.storeSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, description },
      create: { key, value: value as Prisma.InputJsonValue, description },
    });
  }
}
