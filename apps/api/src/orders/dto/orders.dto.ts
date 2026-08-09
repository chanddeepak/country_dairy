import { DeliveryType, OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsUUID(undefined, { message: 'A delivery address is required' })
  addressId: string;

  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType = DeliveryType.LOCAL;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}

export class VerifyPaymentDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @MinLength(1)
  razorpayPaymentId: string;

  @IsString()
  @MinLength(1)
  signature: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'Unknown order status' })
  status: OrderStatus;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
