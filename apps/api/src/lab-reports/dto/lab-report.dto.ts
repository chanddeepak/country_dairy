import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * One tested row on the report.
 *
 * Deliberately free-form: a ghee report lists milk fat and Reichert value, a
 * honey report lists moisture and HMF, and a mustard oil report lists an
 * argemone test. Fixed columns would mean a migration per product line.
 */
export class LabParameterDto {
  @IsString()
  @MinLength(1, { message: 'Each parameter needs a name' })
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(120)
  value: string;

  /** The permissible limit this was measured against, e.g. "min 99.5%". */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  standard?: string;

  /** Undefined means the lab reported a figure without a pass/fail verdict. */
  @IsOptional()
  @IsBoolean()
  passed?: boolean;
}

export class CreateLabReportDto {
  @IsString()
  @MinLength(1, { message: 'Choose the product this batch belongs to' })
  productId: string;

  @IsString()
  @MinLength(3, { message: 'Batch number must be at least 3 characters' })
  @MaxLength(60)
  batchNumber: string;

  @IsDateString({}, { message: 'Enter the date the batch was tested' })
  testDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  labName?: string;

  // The PDF is stored as a relative bucket path (/lab-reports/abc.pdf) and
  // resolved to a CDN URL at render time, so @IsUrl would reject every value
  // the uploader produces. Absolute https URLs are accepted too.
  @IsOptional()
  @Matches(/^(https:\/\/[^\s]+|\/[A-Za-z0-9._\-/]+)$/, {
    message: 'The report must be an uploaded file path or an https URL',
  })
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40, { message: 'A report can list up to 40 parameters' })
  @ValidateNested({ each: true })
  @Type(() => LabParameterDto)
  parameters?: LabParameterDto[];

  /** Unpublished reports stay in the console and never reach the storefront. */
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateLabReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  testDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  labName?: string;

  @IsOptional()
  @Matches(/^(https:\/\/[^\s]+|\/[A-Za-z0-9._\-/]+)$/, {
    message: 'The report must be an uploaded file path or an https URL',
  })
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => LabParameterDto)
  parameters?: LabParameterDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
