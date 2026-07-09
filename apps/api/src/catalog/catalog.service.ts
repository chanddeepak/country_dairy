import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private prisma: PrismaService) {}

  async getCategories() {
    this.logger.log('Fetching all product categories');
    try {
      return await this.prisma.category.findMany({
        include: {
          subCategories: true,
        },
        where: {
          parentId: null, // Return root level categories with children
        },
      });
    } catch (error) {
      this.logger.error('Failed to fetch categories', error.stack);
      throw error;
    }
  }

  async getProducts(categoryId?: string, search?: string) {
    this.logger.log(`Fetching products (categoryId: ${categoryId ?? 'none'}, search: ${search ?? 'none'})`);
    try {
      const whereClause: any = {};

      if (categoryId) {
        whereClause.categoryId = categoryId;
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const products = await this.prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
        },
      });

      // Calculate aggregate rating parameters dynamically
      return products.map((product) => {
        const totalReviews = product.reviews.length;
        const averageRating =
          totalReviews > 0
            ? Number((product.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(2))
            : 0;

        return {
          ...product,
          averageRating,
          totalReviews,
          reviews: undefined, // Omit detailed reviews for list view
        };
      });
    } catch (error) {
      this.logger.error('Failed to fetch products list', error.stack);
      throw error;
    }
  }

  async getProductBySlug(slug: string) {
    this.logger.log(`Fetching detailed product profile for slug: ${slug}`);
    try {
      const product = await this.prisma.product.findUnique({
        where: { slug },
        include: {
          category: true,
          labReports: {
            orderBy: {
              testDate: 'desc',
            },
            take: 1, // Only return the latest lab test report verification
          },
          reviews: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!product) {
        this.logger.warn(`Product profile not found for slug: ${slug}`);
        throw new NotFoundException(`Product with slug '${slug}' not found`);
      }

      const totalReviews = product.reviews.length;
      const averageRating =
        totalReviews > 0
          ? Number((product.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(2))
          : 0;

      return {
        ...product,
        averageRating,
        totalReviews,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch product detailed profile (slug: ${slug})`, error.stack);
      throw error;
    }
  }
}
