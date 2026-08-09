import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: { id: string }) {
    return this.cartService.getCart(user.id);
  }

  @Post('add')
  async addToCart(@CurrentUser() user: { id: string }, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(user.id, dto.variantId, dto.quantity);
  }

  @Put('update')
  async updateCartItem(@CurrentUser() user: { id: string }, @Body() dto: UpdateCartItemDto) {
    return this.cartService.updateCartItem(user.id, dto.itemId, dto.quantity);
  }

  @Delete('remove/:id')
  async removeFromCart(@CurrentUser() user: { id: string }, @Param('id') itemId: string) {
    return this.cartService.removeFromCart(user.id, itemId);
  }

  @Delete('clear')
  async clearCart(@CurrentUser() user: { id: string }) {
    return this.cartService.clearCart(user.id);
  }
}
