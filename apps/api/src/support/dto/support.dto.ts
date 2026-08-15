import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupportStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @MinLength(3, { message: 'Give your question a short subject' })
  @MaxLength(120)
  subject: string;

  @IsString()
  @MinLength(10, { message: 'Tell us a little more so we can help' })
  @MaxLength(4000)
  body: string;

  /** Optional: most questions are about a specific order. */
  @IsOptional()
  @IsUUID(undefined, { message: 'That is not a valid order' })
  orderId?: string;
}

export class ReplyDto {
  @IsString()
  @MinLength(1, { message: 'A reply cannot be empty' })
  @MaxLength(4000)
  body: string;
}

export class SetTicketStatusDto {
  @IsEnum(SupportStatus, {
    message: 'Status must be OPEN, AWAITING_CUSTOMER, RESOLVED or CLOSED',
  })
  status: SupportStatus;
}

export class GuestTicketDto {
  @IsString()
  @MinLength(2, { message: 'Tell us your name' })
  @MaxLength(80)
  name: string;

  @IsEmail({}, { message: 'Enter an email address we can reply to' })
  email: string;

  @IsString()
  @MinLength(3, { message: 'Give your question a short subject' })
  @MaxLength(120)
  subject: string;

  @IsString()
  @MinLength(10, { message: 'Tell us a little more so we can help' })
  @MaxLength(4000)
  body: string;
}
