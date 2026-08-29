import { DeliveryType, OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GuestCartItemDto {
  @IsUUID()
  variantId: string;

  // Capped so a typo or a hostile client cannot ask for a million jars and
  // have the stock check do the arguing.
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class CheckoutDto {
  /**
   * Optional now. Cashfree's checkout collects and verifies an address during
   * payment and returns it on confirm, so requiring one here would make the
   * customer type an address they are about to type again. A signed-in
   * customer may still pass one, which prefills their form.
   */
  @IsOptional()
  @IsUUID()
  addressId?: string;

  /**
   * A guest's cart lives in their browser, so it travels with the request.
   * Variant ids and quantities only — prices are read from our own rows, since
   * a client that could name its own price would be a checkout that charges
   * whatever it is told to.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  items?: GuestCartItemDto[];

  /**
   * An interrupted checkout to pick up rather than replace.
   *
   * Sent when the customer closed the payment window and came back. The server
   * decides whether it is really resumable — same basket, still unpaid, still
   * open at Cashfree — and quietly makes a new order if not.
   */
  @IsOptional()
  @IsUUID()
  resumeOrderId?: string;

  /** Proof the interrupted order is theirs, when there is no session. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  claimToken?: string;

  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType = DeliveryType.COURIER;

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

export class ConfirmOrderDto {
  @IsUUID()
  orderId: string;

  /**
   * What a guest presents instead of a session. Optional because a signed-in
   * customer is already identified by their token.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  claimToken?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class SetDeliveryTypeDto {
  @IsEnum(DeliveryType, { message: 'Choose local delivery or courier' })
  deliveryType: DeliveryType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
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

  /** Free text: the carrier list changes without a deploy. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shippingCarrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class ExpireAbandonedDto {
  /**
   * How long to leave a checkout alone before treating it as over.
   *
   * Floored at fifteen minutes: a customer who has switched to a banking app
   * to approve a payment is still buying, and cancelling underneath them is
   * far worse than holding a jar for another hour.
   */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(10080)
  olderThanMinutes?: number;
}
