import { MediaType, ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsString()
  @MinLength(1, { message: 'Every variant needs a size label' })
  @MaxLength(80)
  sizeLabel: string;

  // No default price. A missing price is a mistake to surface, not something
  // to invent — the previous `|| 100` fallback silently created ₹100 variants.
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Selling price must be a number' })
  @Min(0.01, { message: 'Selling price must be greater than zero' })
  @Type(() => Number)
  sellingPrice: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'MRP must be a number' })
  @Min(0.01, { message: 'MRP must be greater than zero' })
  @Type(() => Number)
  mrpPrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  lowStockThreshold?: number;

  /** Code from the PackagingOption table, e.g. GLASS_JAR. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  packagingCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  weightGrams?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  // Courier rates are charged on volumetric weight, so a parcel cannot be
  // quoted or booked without these. They belong to the variant and the console
  // is where they are entered.
  @IsOptional()
  @IsNumber()
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  heightCm?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Gives this size its own card on the homepage shelf. */
  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;
}

export class ProductImageDto {
  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsEnum(MediaType, { message: 'mediaType must be IMAGE or VIDEO' })
  mediaType?: MediaType;

  /** Poster frame for a video. */
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  variantId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isVariantPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2, { message: 'Product title is required' })
  @MaxLength(160)
  title: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug may contain lowercase letters, numbers and hyphens only',
  })
  slug?: string;

  // Either an existing category id or a name to resolve/create. One is
  // required: the old code fell back to a literal 'cat-1' that does not exist,
  // which fails the foreign key.
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  storyDescription?: string;

  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Status must be DRAFT, LIVE or ARCHIVED' })
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  forceOutOfStock?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badgeText?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isSubscriptionAllowed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchCode?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @Matches(/^[0-9]{4,8}$/, { message: 'HSN code is 4 to 8 digits' })
  hsnCode?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  gstRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaDescription?: string;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  nutritionFacts?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  galleryImages?: ProductImageDto[];
}

/** Same shape, every field optional — a partial edit must not wipe fields. */
export class UpdateProductDto extends CreateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  declare title: string;
}

export class CategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug may contain lowercase letters, numbers and hyphens only',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  iconName?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  parentId?: string;
}
