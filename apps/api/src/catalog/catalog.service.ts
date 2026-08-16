import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaType, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AuditService } from '../audit/audit.service';
import {
  CategoryDto,
  CreateProductDto,
  ProductImageDto,
  UpdateProductDto,
} from './dto/catalog.dto';

function sanitizeProductStoragePath(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes('/storage/v1/object/public/')) {
    const parts = url.split('/storage/v1/object/public/')[1];
    return parts ? `/${parts}` : url;
  }
  return url;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
    private audit: AuditService,
  ) {}

  async getCategories(options: { activeOnly?: boolean } = {}) {
    this.logger.log(`Fetching product categories (activeOnly: ${!!options.activeOnly})`);
    try {
      return await this.prisma.category.findMany({
        where: options.activeOnly ? { isActive: true } : undefined,
        orderBy: { displayOrder: 'asc' },
        include: {
          subCategories: true,
        },
      });
    } catch (error) {
      this.logger.error('Failed to fetch categories', error.stack);
      throw error;
    }
  }

  async getPackagingOptions() {
    return this.prisma.packagingOption.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createCategory(dto: CategoryDto) {
    this.logger.log(`Creating category: ${dto.name}`);
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description || '',
        iconName: dto.iconName || 'Package',
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateCategory(id: string, dto: CategoryDto) {
    this.logger.log(`Updating category: ${id}`);
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Category ${id} not found`);

    return await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        slug: dto.slug ?? existing.slug,
        description: dto.description ?? existing.description,
        iconName: dto.iconName ?? existing.iconName,
        displayOrder: dto.displayOrder !== undefined ? Number(dto.displayOrder) : existing.displayOrder,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });
  }

  async deleteCategory(id: string) {
    this.logger.log(`Deleting category: ${id}`);
    return await this.prisma.category.delete({ where: { id } });
  }

  async getProducts(categoryId?: string, search?: string, status?: string) {
    this.logger.log(`Fetching products (category: ${categoryId}, search: ${search}, status: ${status})`);
    try {
      const whereClause: Prisma.ProductWhereInput = {};

      if (categoryId) {
        whereClause.categoryId = categoryId;
      }

      if (status) {
        whereClause.status = status as ProductStatus;
      }

      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { tagline: { contains: search, mode: 'insensitive' } },
          { storyDescription: { contains: search, mode: 'insensitive' } },
        ];
      }

      const products = await this.prisma.product.findMany({
        where: whereClause,
        orderBy: { displayOrder: 'asc' },
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          variants: {
            orderBy: { displayOrder: 'asc' },
          },
          galleryImages: {
            orderBy: { displayOrder: 'asc' },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
          // The console's batch column reads this. Published only: a held-back
          // report must not present itself as the batch currently on sale.
          labReports: {
            where: { isPublished: true },
            orderBy: { testDate: 'desc' },
            take: 1,
            select: { batchNumber: true, testDate: true },
          },
        },
      });

      return products.map((product) => {
        const totalReviews = product.reviews.length;
        const averageRating =
          totalReviews > 0
            ? Number((product.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(2))
            : 0;

        const latest = product.labReports[0];

        return {
          ...product,
          categoryName: product.category?.name || 'Dairy',
          averageRating,
          totalReviews,
          latestBatchNumber: latest?.batchNumber ?? null,
          latestBatchTestDate: latest?.testDate?.toISOString() ?? null,
          reviews: undefined,
          labReports: undefined,
        };
      });
    } catch (error) {
      this.logger.error('Failed to fetch products list', error.stack);
      throw error;
    }
  }

  async getProductBySlugOrId(slugOrId: string, options: { liveOnly?: boolean } = {}) {
    this.logger.log(`Fetching detailed product profile for: ${slugOrId}`);
    try {
      const product = await this.prisma.product.findFirst({
        where: {
          OR: [{ id: slugOrId }, { slug: slugOrId }],
          ...(options.liveOnly ? { status: ProductStatus.LIVE } : {}),
        },
        include: {
          category: true,
          variants: { orderBy: { displayOrder: 'asc' } },
          galleryImages: { orderBy: { displayOrder: 'asc' } },
          labReports: {
            // The storefront shows the latest batch tested; the console needs
            // to see held-back ones too, hence the same liveOnly switch the
            // reviews use.
            where: options.liveOnly ? { isPublished: true } : undefined,
            orderBy: { testDate: 'desc' },
            take: 1,
          },
          reviews: {
            // Only moderated reviews reach the storefront.
            // Ratings count every review still standing. There is no approval
            // gate any more — only a takedown, which sets deletedAt.
            where: options.liveOnly ? { deletedAt: null } : undefined,
            include: {
              user: {
                select: { name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product ${slugOrId} not found`);
      }

      // Computed here as well as in getProducts. Without it the detail page
      // rendered "0.0 (1 reviews)" — the count came from the reviews array
      // while the average was simply absent.
      const totalReviews = product.reviews.length;
      const averageRating =
        totalReviews > 0
          ? Number((product.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(2))
          : 0;

      return {
        ...product,
        categoryName: product.category?.name || 'Dairy',
        averageRating,
        totalReviews,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch product ${slugOrId}`, error.stack);
      throw error;
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /** Resolves a category by id or name, creating it by name if needed. */
  private async resolveCategoryId(dto: {
    categoryId?: string;
    categoryName?: string;
  }): Promise<string> {
    if (dto.categoryId) {
      const exists = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!exists) throw new BadRequestException('That category no longer exists');
      return dto.categoryId;
    }

    if (dto.categoryName) {
      const existing = await this.prisma.category.findFirst({ where: { name: dto.categoryName } });
      if (existing) return existing.id;

      const created = await this.prisma.category.create({
        data: { name: dto.categoryName, slug: this.slugify(dto.categoryName) },
      });
      return created.id;
    }

    // The old code fell back to a literal 'cat-1', which does not exist and
    // fails the foreign key with an opaque 500.
    throw new BadRequestException('Choose a category for this product');
  }

  private mapGalleryImages(images: ProductImageDto[] = []) {
    return images.map((img, idx) => ({
      imageUrl: sanitizeProductStoragePath(img.imageUrl) || '/images/products/milk-bottle.png',
      mediaType: img.mediaType ?? MediaType.IMAGE,
      thumbnailUrl: img.thumbnailUrl ? sanitizeProductStoragePath(img.thumbnailUrl) : null,
      durationSeconds: img.durationSeconds ?? null,
      variantId: img.variantId || null,
      altText: img.altText,
      // A video is never the catalogue cover — a card needs a still.
      isPrimary: img.mediaType === MediaType.VIDEO ? false : (img.isPrimary ?? idx === 0),
      isVariantPrimary: img.mediaType === MediaType.VIDEO ? false : (img.isVariantPrimary ?? false),
      displayOrder: idx + 1,
    }));
  }

  async createProduct(dto: CreateProductDto) {
    const slug = dto.slug || this.slugify(dto.title);

    const clash = await this.prisma.product.findUnique({ where: { slug } });
    if (clash) {
      throw new BadRequestException(`A product with the web address "${slug}" already exists`);
    }

    const categoryId = await this.resolveCategoryId(dto);

    const product = await this.prisma.product.create({
      data: {
        title: dto.title,
        slug,
        tagline: dto.tagline,
        storyDescription: dto.storyDescription,
        status: dto.status ?? ProductStatus.DRAFT,
        forceOutOfStock: dto.forceOutOfStock ?? false,
        badgeText: dto.badgeText,
        isFeatured: dto.isFeatured ?? false,
        displayOrder: dto.displayOrder ?? 1,
        isSubscriptionAllowed: dto.isSubscriptionAllowed ?? false,
        batchCode: dto.batchCode,
        verified: dto.verified ?? false,
        hsnCode: dto.hsnCode,
        gstRate: dto.gstRate ?? 0,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        specifications: (dto.specifications ?? {}) as Prisma.InputJsonValue,
        nutritionFacts: (dto.nutritionFacts ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        categoryId,
        variants: {
          create: (dto.variants ?? []).map((v, idx) => ({
            sku: v.sku || `CD-${slug.toUpperCase()}-${idx + 1}`,
            sizeLabel: v.sizeLabel,
            // Prices come from the request. A missing price is rejected by the
            // DTO rather than silently becoming ₹100.
            sellingPrice: v.sellingPrice,
            mrpPrice: v.mrpPrice,
            stockQuantity: v.stockQuantity ?? 0,
            lowStockThreshold: v.lowStockThreshold ?? 10,
            packagingCode: v.packagingCode ?? null,
            weightGrams: v.weightGrams,
            barcode: v.barcode ?? null,
            lengthCm: v.lengthCm ?? null,
            widthCm: v.widthCm ?? null,
            heightCm: v.heightCm ?? null,
            imageUrl: v.imageUrl ? sanitizeProductStoragePath(v.imageUrl) : null,
            isActive: v.isActive ?? true,
            showOnHome: v.showOnHome ?? false,
            displayOrder: idx + 1,
          })),
        },
        galleryImages: { create: this.mapGalleryImages(dto.galleryImages) },
      },
      include: { variants: true, galleryImages: true, category: true },
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      after: { title: product.title, slug: product.slug, status: product.status },
    });

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { galleryImages: true, variants: true },
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    const categoryId =
      dto.categoryId || dto.categoryName ? await this.resolveCategoryId(dto) : existing.categoryId;

    // Gallery: replace wholesale, cleaning up files that are no longer used.
    if (dto.galleryImages) {
      const nextUrls = dto.galleryImages.map((img) => sanitizeProductStoragePath(img.imageUrl));

      for (const oldImg of existing.galleryImages) {
        if (oldImg.imageUrl && !nextUrls.includes(oldImg.imageUrl)) {
          await this.mediaService.deleteMediaFile(oldImg.imageUrl);
        }
      }

      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      await this.prisma.productImage.createMany({
        data: this.mapGalleryImages(dto.galleryImages).map((img) => ({ ...img, productId: id })),
      });
    }

    /*
     * Variants are matched and updated in place, keyed on id then SKU.
     *
     * The previous implementation deleted every variant and recreated them on
     * each save. That detached order history from the variant it was sold as,
     * cascade-deleted the item out of every customer's cart, and issued new
     * ids so any open admin tab was editing rows that no longer existed.
     */
    if (dto.variants?.length) {
      const slugStr = (dto.slug || existing.slug).toUpperCase();
      const keepIds: string[] = [];

      for (const [idx, v] of dto.variants.entries()) {
        const match = v.id
          ? existing.variants.find((e) => e.id === v.id)
          : v.sku
            ? existing.variants.find((e) => e.sku === v.sku)
            : undefined;

        const data = {
          sizeLabel: v.sizeLabel,
          sellingPrice: v.sellingPrice,
          mrpPrice: v.mrpPrice,
          stockQuantity: v.stockQuantity ?? match?.stockQuantity ?? 0,
          lowStockThreshold: v.lowStockThreshold ?? 10,
          packagingCode: v.packagingCode ?? null,
          weightGrams: v.weightGrams,
          barcode: v.barcode ?? null,
          lengthCm: v.lengthCm ?? null,
          widthCm: v.widthCm ?? null,
          heightCm: v.heightCm ?? null,
          imageUrl: v.imageUrl ? sanitizeProductStoragePath(v.imageUrl) : null,
          isActive: v.isActive ?? true,
          showOnHome: v.showOnHome ?? false,
          displayOrder: idx + 1,
        };

        if (match) {
          await this.prisma.productVariant.update({ where: { id: match.id }, data });
          keepIds.push(match.id);
        } else {
          const created = await this.prisma.productVariant.create({
            data: { ...data, productId: id, sku: v.sku || `CD-${slugStr}-${Date.now()}-${idx}` },
          });
          keepIds.push(created.id);
        }
      }

      // A variant the editor removed is deactivated rather than deleted when it
      // has been sold, so the order history keeps pointing at something real.
      const removed = existing.variants.filter((e) => !keepIds.includes(e.id));
      for (const variant of removed) {
        const sold = await this.prisma.orderItem.count({ where: { variantId: variant.id } });
        if (sold > 0) {
          await this.prisma.productVariant.update({
            where: { id: variant.id },
            data: { isActive: false },
          });
        } else {
          await this.prisma.cartItem.deleteMany({ where: { variantId: variant.id } });
          await this.prisma.productVariant.delete({ where: { id: variant.id } });
        }
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        slug: dto.slug ?? existing.slug,
        tagline: dto.tagline ?? existing.tagline,
        storyDescription: dto.storyDescription ?? existing.storyDescription,
        status: dto.status ?? existing.status,
        forceOutOfStock: dto.forceOutOfStock ?? existing.forceOutOfStock,
        badgeText: dto.badgeText ?? existing.badgeText,
        isFeatured: dto.isFeatured ?? existing.isFeatured,
        displayOrder: dto.displayOrder ?? existing.displayOrder,
        isSubscriptionAllowed: dto.isSubscriptionAllowed ?? existing.isSubscriptionAllowed,
        batchCode: dto.batchCode ?? existing.batchCode,
        verified: dto.verified ?? existing.verified,
        hsnCode: dto.hsnCode ?? existing.hsnCode,
        gstRate: dto.gstRate ?? existing.gstRate,
        metaTitle: dto.metaTitle ?? existing.metaTitle,
        metaDescription: dto.metaDescription ?? existing.metaDescription,
        specifications: (dto.specifications ?? existing.specifications ?? {}) as Prisma.InputJsonValue,
        nutritionFacts: (dto.nutritionFacts ?? existing.nutritionFacts ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? existing.metadata ?? {}) as Prisma.InputJsonValue,
        categoryId,
      },
      include: {
        variants: { orderBy: { displayOrder: 'asc' } },
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        category: true,
      },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      before: { title: existing.title, status: existing.status, variantCount: existing.variants.length },
      after: { title: updated.title, status: updated.status, variantCount: updated.variants.length },
    });

    return updated;
  }

  async toggleSubscription(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isSubscriptionAllowed: !existing.isSubscriptionAllowed },
    });

    await this.audit.record({
      action: 'TOGGLE',
      entity: 'Product',
      entityId: id,
      before: { isSubscriptionAllowed: existing.isSubscriptionAllowed },
      after: { isSubscriptionAllowed: updated.isSubscriptionAllowed },
    });

    return updated;
  }

  async deleteProduct(id: string) {
    this.logger.log(`Hard deleting product and all related DB data: ${id}`);
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { galleryImages: true, variants: true },
    });

    if (!existing) {
      this.logger.log(`Product ${id} not found in DB.`);
      return { success: true, message: `Product ${id} deleted` };
    }

    // A product that has ever been sold, or that someone is subscribed to, is
    // archived rather than destroyed. Deleting it would take order history and
    // active subscriptions with it — the previous implementation ran
    // orderItem.deleteMany here, erasing the revenue record along with it.
    const [orderedCount, subscribedCount] = await Promise.all([
      this.prisma.orderItem.count({ where: { productId: id } }),
      this.prisma.subscription.count({
        where: { productId: id, status: { in: ['ACTIVE', 'PAUSED'] } },
      }),
    ]);

    if (orderedCount > 0 || subscribedCount > 0) {
      this.logger.log(
        `Archiving product ${id} instead of deleting ` +
          `(${orderedCount} order lines, ${subscribedCount} live subscriptions)`,
      );

      await this.prisma.$transaction([
        this.prisma.product.update({
          where: { id },
          data: { status: ProductStatus.ARCHIVED, isFeatured: false },
        }),
        this.prisma.productVariant.updateMany({
          where: { productId: id },
          data: { isActive: false },
        }),
        this.prisma.cartItem.deleteMany({ where: { productId: id } }),
      ]);

      await this.audit.record({
        action: 'ARCHIVE',
        entity: 'Product',
        entityId: id,
        before: { title: existing.title, status: existing.status },
        after: { status: 'ARCHIVED', reason: `${orderedCount} order lines, ${subscribedCount} subscriptions` },
      });

      return {
        success: true,
        id,
        archived: true,
        message:
          'Product has sales or subscription history, so it was archived and hidden ' +
          'from the storefront rather than deleted.',
      };
    }

    // Never sold: safe to remove outright.
    for (const img of existing.galleryImages) {
      await this.mediaService.deleteMediaFile(img.imageUrl);
    }

    await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({ where: { productId: id } }),
      this.prisma.labReport.deleteMany({ where: { productId: id } }),
      this.prisma.cartItem.deleteMany({ where: { productId: id } }),
      this.prisma.productReview.deleteMany({ where: { productId: id } }),
      this.prisma.subscription.deleteMany({ where: { productId: id } }),
      this.prisma.productVariant.deleteMany({ where: { productId: id } }),
      this.prisma.product.delete({ where: { id } }),
    ]);

    await this.audit.record({
      action: 'DELETE',
      entity: 'Product',
      entityId: id,
      before: { title: existing.title, slug: existing.slug, status: existing.status },
    });

    return { success: true, id, archived: false };
  }
}
