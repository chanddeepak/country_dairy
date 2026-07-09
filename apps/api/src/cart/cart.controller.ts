import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: any) {
    return this.cartService.getCart(user.id);
  }

  @Post('add')
  async addToCart(
    @CurrentUser() user: any,
    @Body('productId') productId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartService.addToCart(user.id, productId, quantity);
  }

  @Put('update')
  async updateCartItem(
    @CurrentUser() user: any,
    @Body('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartService.updateCartItem(user.id, itemId, quantity);
  }

  @Delete('remove/:id')
  async removeFromCart(@CurrentUser() user: any, @Param('id') itemId: string) {
    return this.cartService.removeFromCart(user.id, itemId);
  }
}
