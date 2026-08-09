import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddToCartDto {
  @IsUUID(undefined, { message: 'Select a product option' })
  variantId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(99, { message: 'Quantity cannot exceed 99 per item' })
  quantity: number;
}

export class UpdateCartItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(0)
  @Max(99)
  quantity: number;
}
