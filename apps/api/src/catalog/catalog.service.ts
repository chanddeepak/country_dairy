import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';

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
  ) {}

  async getCategories() {
    this.logger.log('Fetching all product categories');
    try {
      return await this.prisma.category.findMany({
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

  async createCategory(dto: any) {
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

  async updateCategory(id: string, dto: any) {
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
      const whereClause: any = {};

      if (categoryId) {
        whereClause.categoryId = categoryId;
      }

      if (status) {
        whereClause.status = status;
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
        },
      });

      return products.map((product) => {
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
          reviews: undefined,
        };
      });
    } catch (error) {
      this.logger.error('Failed to fetch products list', error.stack);
      throw error;
    }
  }

  async getProductBySlugOrId(slugOrId: string) {
    this.logger.log(`Fetching detailed product profile for: ${slugOrId}`);
    try {
      const product = await this.prisma.product.findFirst({
        where: {
          OR: [{ id: slugOrId }, { slug: slugOrId }],
        },
        include: {
          category: true,
          variants: { orderBy: { displayOrder: 'asc' } },
          galleryImages: { orderBy: { displayOrder: 'asc' } },
          labReports: {
            orderBy: { testDate: 'desc' },
            take: 1,
          },
          reviews: {
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

      return {
        ...product,
        categoryName: product.category?.name || 'Dairy',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch product ${slugOrId}`, error.stack);
      throw error;
    }
  }

  async createProduct(dto: any) {
    this.logger.log(`Creating product: ${dto.title}`);
    const slug = dto.slug || dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Resolve or create category
    let categoryId = dto.categoryId;
    if (!categoryId && dto.categoryName) {
      let cat = await this.prisma.category.findFirst({ where: { name: dto.categoryName } });
      if (!cat) {
        cat = await this.prisma.category.create({
          data: {
            name: dto.categoryName,
            slug: dto.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          },
        });
      }
      categoryId = cat.id;
    }

    const galleryData = (dto.galleryImages || []).map((img: any, idx: number) => {
      const urlStr = typeof img === 'string' ? img : img.imageUrl;
      return {
        imageUrl: sanitizeProductStoragePath(urlStr) || '/images/products/milk-bottle.png',
        isPrimary: typeof img === 'object' && img.isPrimary !== undefined ? img.isPrimary : idx === 0,
        displayOrder: idx + 1,
      };
    });

    return await this.prisma.product.create({
      data: {
        title: dto.title,
        slug,
        tagline: dto.tagline || '',
        storyDescription: dto.storyDescription || '',
        status: dto.status || 'DRAFT',
        badgeText: dto.badgeText || '',
        isFeatured: dto.isFeatured ?? false,
        displayOrder: dto.displayOrder ? Number(dto.displayOrder) : 1,
        isSubscriptionAllowed: dto.isSubscriptionAllowed ?? false,
        batchCode: dto.batchCode || '',
        verified: dto.verified ?? false,
        specifications: dto.specifications || {},
        nutritionFacts: dto.nutritionFacts || {},
        categoryId: categoryId || 'cat-1',
        variants: {
          create: (dto.variants || []).map((v: any, idx: number) => ({
            sku: v.sku || `CD-${slug.toUpperCase()}-${idx + 1}`,
            sizeLabel: v.sizeLabel || 'Standard Pack',
            sellingPrice: v.sellingPrice || 100,
            mrpPrice: v.mrpPrice || 120,
            stockQuantity: v.stockQuantity || 50,
            lowStockThreshold: v.lowStockThreshold || 10,
            packagingType: v.packagingType || 'GLASS_JAR',
            isActive: v.isActive ?? true,
            displayOrder: idx + 1,
          })),
        },
        galleryImages: {
          create: galleryData,
        },
      },
      include: {
        variants: true,
        galleryImages: true,
      },
    });
  }

  async updateProduct(id: string, dto: any) {
    this.logger.log(`Updating product: ${id}`);
    
    // Resolve category if categoryName passed
    let categoryId = dto.categoryId;
    if (!categoryId && dto.categoryName) {
      let cat = await this.prisma.category.findFirst({ where: { name: dto.categoryName } });
      if (!cat) {
        cat = await this.prisma.category.create({
          data: {
            name: dto.categoryName,
            slug: dto.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          },
        });
      }
      categoryId = cat.id;
    }

    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { galleryImages: true, variants: true },
    });

    if (!existing) {
      this.logger.log(`Product ${id} not found in DB. Upserting as new product...`);
      return this.createProduct({
        ...dto,
        id: id.startsWith('prod-') ? undefined : id,
      });
    }

    // 1. Update Gallery Images if provided
    if (dto.galleryImages && Array.isArray(dto.galleryImages)) {
      const newUrls = dto.galleryImages.map((img: any) => sanitizeProductStoragePath(typeof img === 'string' ? img : img.imageUrl));
      for (const oldImg of existing.galleryImages) {
        if (oldImg.imageUrl && !newUrls.includes(oldImg.imageUrl)) {
          this.logger.log(`Cleaning up old product gallery image: ${oldImg.imageUrl}`);
          await this.mediaService.deleteMediaFile(oldImg.imageUrl);
        }
      }

      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      await this.prisma.productImage.createMany({
        data: dto.galleryImages.map((img: any, idx: number) => {
          const urlStr = typeof img === 'string' ? img : img.imageUrl;
          return {
            productId: id,
            imageUrl: sanitizeProductStoragePath(urlStr) || '/images/products/milk-bottle.png',
            isPrimary: typeof img === 'object' && img.isPrimary !== undefined ? img.isPrimary : idx === 0,
            displayOrder: idx + 1,
          };
        }),
      });
    }

    // 2. Update Variants Matrix if provided
    if (dto.variants && Array.isArray(dto.variants) && dto.variants.length > 0) {
      const slugStr = (dto.slug || existing.slug || 'product').toLowerCase();
      await this.prisma.productVariant.deleteMany({ where: { productId: id } });
      await this.prisma.productVariant.createMany({
        data: dto.variants.map((v: any, idx: number) => ({
          productId: id,
          sku: v.sku || `CD-${slugStr.toUpperCase()}-${idx + 1}`,
          sizeLabel: v.sizeLabel || v.name || 'Standard Pack',
          sellingPrice: Number(v.sellingPrice || v.price || 100),
          mrpPrice: Number(v.mrpPrice || v.originalPrice || 120),
          stockQuantity: Number(v.stockQuantity ?? 50),
          lowStockThreshold: Number(v.lowStockThreshold ?? 10),
          packagingType: v.packagingType || 'GLASS_JAR',
          isActive: v.isActive ?? true,
          displayOrder: idx + 1,
        })),
      });
    }

    // 3. Update Core Product Details
    return await this.prisma.product.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        slug: dto.slug ?? existing.slug,
        tagline: dto.tagline ?? existing.tagline,
        storyDescription: dto.storyDescription ?? existing.storyDescription,
        status: dto.status ?? existing.status,
        badgeText: dto.badgeText ?? existing.badgeText,
        isFeatured: dto.isFeatured ?? existing.isFeatured,
        isSubscriptionAllowed: dto.isSubscriptionAllowed ?? existing.isSubscriptionAllowed,
        batchCode: dto.batchCode ?? existing.batchCode,
        verified: dto.verified ?? existing.verified,
        specifications: dto.specifications ?? existing.specifications,
        nutritionFacts: dto.nutritionFacts ?? existing.nutritionFacts,
        categoryId: categoryId || existing.categoryId,
      },
      include: {
        variants: { orderBy: { displayOrder: 'asc' } },
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        category: true,
      },
    });
  }

  async toggleSubscription(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    return await this.prisma.product.update({
      where: { id },
      data: { isSubscriptionAllowed: !existing.isSubscriptionAllowed },
    });
  }

  async deleteProduct(id: string) {
    this.logger.log(`Deleting/Archiving product: ${id}`);
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { galleryImages: true },
    });
    if (existing?.galleryImages) {
      for (const img of existing.galleryImages) {
        await this.mediaService.deleteMediaFile(img.imageUrl);
      }
    }
    return await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }
}
