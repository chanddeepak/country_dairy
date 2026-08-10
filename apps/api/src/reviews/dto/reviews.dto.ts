import { MediaType, ReviewStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 5' })
  @Max(5, { message: 'Rating must be between 1 and 5' })
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  // Media is stored as a relative bucket path (/review-media/abc.webp) and
  // resolved to a CDN URL at render time, so @IsUrl would reject every value
  // the uploader actually produces. Absolute https URLs are accepted too.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'You can attach up to 5 photos or videos' })
  @Matches(/^(https:\/\/[^\s]+|\/[A-Za-z0-9._\-/]+)$/, {
    each: true,
    message: 'Each attachment must be an uploaded file path or an https URL',
  })
  mediaUrls?: string[];

  /** Parallel to mediaUrls: mediaTypes[i] describes mediaUrls[i]. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(MediaType, { each: true })
  mediaTypes?: MediaType[];
}

/** Same fields as create, all optional — a partial edit must not wipe others. */
export class UpdateReviewDto extends CreateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 5' })
  @Max(5, { message: 'Rating must be between 1 and 5' })
  declare rating: number;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus, { message: 'Choose approve or reject' })
  status: ReviewStatus;
}
