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
import { CatalogService } from './catalog.service';
import { CategoryDto, CreateProductDto, UpdateProductDto } from './dto/catalog.dto';

const CATALOG_STAFF = [Role.SUPER_ADMIN, Role.CATALOG_MANAGER] as const;

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // --- Public storefront reads ---

  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories({ activeOnly: true });
  }

  /**
   * Storefront listing. Status is pinned to LIVE rather than taken from the
   * query, so an unauthenticated caller cannot page through drafts.
   */
  @Get('products')
  async getPublicProducts(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.getProducts(categoryId, search, 'LIVE');
  }

  @Get('products/:slugOrId')
  async getPublicProduct(@Param('slugOrId') slugOrId: string) {
    return this.catalogService.getProductBySlugOrId(slugOrId, { liveOnly: true });
  }

  // --- Admin catalog management ---

  @Get('admin/categories')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async getCategoriesAdmin() {
    return this.catalogService.getCategories({ activeOnly: false });
  }

  @Get('admin/products')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async getProductsAdmin(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.catalogService.getProducts(categoryId, search, status);
  }

  @Get('admin/products/:slugOrId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async getProductAdmin(@Param('slugOrId') slugOrId: string) {
    return this.catalogService.getProductBySlugOrId(slugOrId, { liveOnly: false });
  }

  @Post('categories')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async createCategory(@Body() body: CategoryDto) {
    return this.catalogService.createCategory(body);
  }

  @Put('categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async updateCategory(@Param('id') id: string, @Body() body: CategoryDto) {
    return this.catalogService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async deleteCategory(@Param('id') id: string) {
    return this.catalogService.deleteCategory(id);
  }

  @Post('products')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async createProduct(@Body() body: CreateProductDto) {
    return this.catalogService.createProduct(body);
  }

  @Put('products/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.catalogService.updateProduct(id, body);
  }

  @Patch('products/:id/toggle-subscription')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async toggleSubscription(@Param('id') id: string) {
    return this.catalogService.toggleSubscription(id);
  }

  @Delete('products/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async deleteProduct(@Param('id') id: string) {
    return this.catalogService.deleteProduct(id);
  }

  @Get('packaging-options')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...CATALOG_STAFF)
  async getPackagingOptions() {
    return this.catalogService.getPackagingOptions();
  }
}
