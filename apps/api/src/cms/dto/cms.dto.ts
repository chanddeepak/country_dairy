import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
