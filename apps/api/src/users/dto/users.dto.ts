import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStaffDto {
  @IsEmail({}, { message: 'A valid work email is required' })
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string;

  @IsEnum(Role, { message: 'Unknown role' })
  role: Role;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Unknown role' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string;
}
