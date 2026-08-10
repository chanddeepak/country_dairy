import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AssignRouteDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one stop to assign' })
  @ArrayMaxSize(200, { message: 'Assign at most 200 stops at a time' })
  @IsString({ each: true })
  orderIds: string[];

  /**
   * Null clears the assignment, which is how a route is handed back when a
   * driver calls in sick. `ValidateIf` lets null through while still rejecting
   * a number or an object.
   */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  driverId: string | null;
}

export class MarkDeliveredDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FailedAttemptDto {
  @IsString()
  @MinLength(3, { message: 'Say why the delivery could not be completed' })
  @MaxLength(500)
  reason: string;
}

export class RouteQueryDto {
  /** IST calendar day. Defaults to today when absent. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  date?: string;
}
