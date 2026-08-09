import { SubscriptionFrequency } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID(undefined, { message: 'Select a product option' })
  variantId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsEnum(SubscriptionFrequency)
  frequency: SubscriptionFrequency;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsDateString({}, { message: 'A valid start date is required' })
  startDate: string;
}

export class TriggerSchedulerDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
