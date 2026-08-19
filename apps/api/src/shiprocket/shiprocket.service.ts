import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Our catalogue, in the shape Shiprocket reads.
 *
 * The shape is Shopify's — `body_html`, `handle`, `compare_at_price`,
 * `option_values` — because that is what their sync was built against. None of
 * it matches our own vocabulary, so this file is a translation layer and
 * nothing else. Resist letting these names leak inward.
 *
 * Only LIVE products are published. A draft is not for sale, and an archived
 * one is not for sale any more; either appearing in their checkout would let
 * someone buy something we do not sell.
 */

const PRODUCT_INCLUDE = {
  category: { select: { name: true } },
  variants: { where: { isActive: true }, orderBy: { displayOrder: 'asc' as const } },
  galleryImages: { where: { isPrimary: true }, take: 1 },
};

@Injectable()
export class ShiprocketService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(page: number, limit: number) {
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.LIVE },
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where: { status: ProductStatus.LIVE } }),
    ]);

    return { data: { total, products: rows.map((p) => this.toShopifyProduct(p)) } };
  }

  async listProductsByCollection(collectionExternalId: bigint, page: number, limit: number) {
    const where = {
      status: ProductStatus.LIVE,
      category: { externalId: collectionExternalId },
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: { total, products: rows.map((p) => this.toShopifyProduct(p)) } };
  }

  async listCollections(page: number, limit: number) {
    // Only categories that actually have something to sell. An empty
    // collection in their checkout is a dead end for a customer.
    const where = { isActive: true, products: { some: { status: ProductStatus.LIVE } } };

    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: {
        total,
        collections: rows.map((c) => ({
          id: Number(c.externalId),
          title: c.name,
          handle: c.slug,
          body_html: c.description ?? '',
          image: { src: '' },
          created_at: c.createdAt.toISOString(),
          updated_at: c.updatedAt.toISOString(),
        })),
      },
    };
  }

  private toShopifyProduct(p: any) {
    const primaryImage = absoluteUrl(p.galleryImages?.[0]?.imageUrl);

    return {
      id: Number(p.externalId),
      title: p.title,
      // They render this as HTML. Our story is plain text, so it is wrapped
      // rather than sent bare, which would run together as one paragraph.
      body_html: p.storyDescription ? `<p>${escapeHtml(p.storyDescription)}</p>` : '',
      vendor: 'Country Dairy',
      product_type: p.category?.name ?? '',
      handle: p.slug,
      tags: p.badgeText ?? '',
      status: 'active',
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      image: { src: primaryImage },
      // One axis, because that is what we sell on: size. Their checkout shows
      // it as the variant picker.
      options: [
        {
          name: 'Size',
          values: p.variants.map((v: any) => v.sizeLabel),
        },
      ],
      variants: p.variants.map((v: any) => this.toShopifyVariant(v, primaryImage)),
    };
  }

  private toShopifyVariant(v: any, fallbackImage: string) {
    const grams = v.weightGrams ?? 0;

    return {
      id: Number(v.externalId),
      title: v.sizeLabel,
      // Decimal strings, not floats. Money that has survived this far as an
      // exact value is not going to be rounded on the way out of the door.
      price: String(v.sellingPrice),
      compare_at_price: String(v.mrpPrice),
      sku: v.sku,
      // Our stock reaches them here, and only here. It is a sync rather than a
      // live check, so this figure is how stale their view can get.
      quantity: v.stockQuantity,
      taxable: true,
      option_values: { Size: v.sizeLabel },
      grams,
      // They want both, in their own units. Sent as kilograms because grams
      // is already given exactly above; a wrong unit here becomes a wrong
      // shipping rate, which becomes a wrong price.
      weight: grams / 1000,
      weight_unit: 'kg',
      image: { src: absoluteUrl(v.imageUrl) || fallbackImage },
      created_at: v.createdAt.toISOString(),
      updated_at: v.updatedAt.toISOString(),
    };
  }
}

/**
 * Absolute URLs only.
 *
 * Our own storefront can resolve "/products/xyz.webp" because it knows where
 * it came from. Shiprocket cannot — it is a different company on a different
 * host, and a relative path there resolves against *their* domain and 404s.
 * Their checkout would show a product with no picture and nobody would know
 * why.
 *
 * Mirrors the storefront's resolver: a bucket path goes to Supabase public
 * storage, an /uploads path to our own host.
 */
function absoluteUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  if (url.startsWith('/uploads/')) {
    const apiHost = (process.env.PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
    return apiHost ? `${apiHost}${url}` : '';
  }

  const cdn = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!cdn) return '';
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${cdn}/storage/v1/object/public${path}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
