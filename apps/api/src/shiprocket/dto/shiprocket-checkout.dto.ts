import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class CheckoutLineDto {
  /** The numeric id Shiprocket knows this size by — ProductVariant.externalId. */
  @IsInt()
  @Type(() => Number)
  variantExternalId: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

/**
 * What the storefront may ask for.
 *
 * Deliberately only the basket. The redirect is built on our side — accepting
 * one here would let a caller mint a signed token pointing our customers at
 * somebody else's page.
 */
export class CreateCheckoutTokenDto {
  @IsArray()
  @ArrayMinSize(1)
  // A basket, not a payload. Somebody posting ten thousand lines is not
  // shopping, and the validation should say so before the database does.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items: CheckoutLineDto[];
}
