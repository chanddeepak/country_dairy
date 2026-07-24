import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Post('categories')
  async createCategory(@Body() body: any) {
    return this.catalogService.createCategory(body);
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.catalogService.deleteCategory(id);
  }

  @Get('products')
  async getProducts(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.catalogService.getProducts(categoryId, search, status);
  }

  @Get('products/:slugOrId')
  async getProductBySlugOrId(@Param('slugOrId') slugOrId: string) {
    return this.catalogService.getProductBySlugOrId(slugOrId);
  }

  @Post('products')
  async createProduct(@Body() body: any) {
    return this.catalogService.createProduct(body);
  }

  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateProduct(id, body);
  }

  @Patch('products/:id/toggle-subscription')
  async toggleSubscription(@Param('id') id: string) {
    return this.catalogService.toggleSubscription(id);
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string) {
    return this.catalogService.deleteProduct(id);
  }
}
