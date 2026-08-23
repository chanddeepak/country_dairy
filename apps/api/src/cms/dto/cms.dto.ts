import { Type } from 'class-transformer';
import { IsBoolean, IsHexColor, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

/**
 * WhatsApp ordering configuration.
 *
 * Lives in StoreSetting rather than a constant so staff can change the number
 * without a redeploy — and so there is exactly one number. The web and mobile
 * apps previously hardcoded two different ones.
 */
export class WhatsAppConfigDto {
  @IsBoolean()
  isEnabled: boolean;

  /** Digits only, including country code, e.g. 919997801112 — wa.me's format. */
  @Matches(/^[1-9][0-9]{9,14}$/, {
    message: 'Enter the number in international format without + or spaces, e.g. 919997801112',
  })
  phoneNumber: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  messageTemplate: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cartMessageTemplate?: string;
}

export class HeroBannerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /**
   * True when the artwork already carries its own headline.
   *
   * The column and its migration have existed since August and nothing ever
   * read or wrote them: not this DTO, not the service, not the console, not the
   * storefront. So every poster-style banner was stored as though it were plain
   * artwork, and the storefront laid an empty headline over the top of it.
   *
   * With whitelist validation on, the console could not have sent this even if
   * it had a control for it — the request would have been rejected outright.
   */
  @IsOptional()
  @IsBoolean()
  imageHasText?: boolean;

  @IsOptional()
  @IsIn(['DESKTOP', 'MOBILE'])
  deviceType?: 'DESKTOP' | 'MOBILE';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ctaLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badgeText?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Where the text sits and how it is set.
   *
   * Accepted as an object and then run through parseHeroLayout in the service
   * rather than validated field by field here. The parser already rejects any
   * value outside its scales and falls back to the default, so a banner can
   * never be saved with an anchor the storefront does not know how to place.
   */
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}

export class AnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  linkUrl?: string;

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @IsOptional()
  @IsHexColor()
  textColor?: string;

  @IsBoolean()
  isActive: boolean;
}

export class TrustBadgeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subtitle: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  iconName?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TrustBadgeOrderDto {
  @ValidateNested({ each: true })
  @Type(() => TrustBadgeOrderItemDto)
  items: TrustBadgeOrderItemDto[];
}

export class TrustBadgeOrderItemDto {
  @IsString()
  id: string;

  @IsInt()
  @Type(() => Number)
  displayOrder: number;
}
