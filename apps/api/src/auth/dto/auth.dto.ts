import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterEmailDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

export class LoginEmailDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;
}

export class GoogleLoginDto {
  @IsString()
  @MinLength(1)
  idToken: string;
}

export class SendOtpDto {
  @Matches(/^\+91[6-9][0-9]{9}$/, {
    message: 'Enter a valid Indian mobile number in +91XXXXXXXXXX format',
  })
  phone: string;
}

export class VerifyOtpDto {
  @Matches(/^\+91[6-9][0-9]{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone: string;

  @Length(6, 6, { message: 'The verification code is 6 digits' })
  otp: string;
}

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state: string;

  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit Indian PIN code' })
  postalCode: string;

  @IsOptional()
  @Matches(/^(\+91)?[6-9][0-9]{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * Every field optional: the account page sends only what changed. The address
 * is snapshotted onto an order at checkout, so editing one never rewrites
 * past orders.
 */
export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit Indian PIN code' })
  postalCode?: string;

  @IsOptional()
  @Matches(/^(\+91)?[6-9][0-9]{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
