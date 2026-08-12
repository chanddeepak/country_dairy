import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import {
  ChangePasswordDto,
  CreateAddressDto,
  DeleteAccountDto,
  GoogleLoginDto,
  LoginEmailDto,
  RegisterEmailDto,
  SendOtpDto,
  UpdateAddressDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/register')
  @HttpCode(HttpStatus.CREATED)
  async registerWithEmail(@Body() dto: RegisterEmailDto) {
    return this.authService.registerWithEmail(dto.email, dto.password, dto.name);
  }

  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  async loginWithEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginWithEmail(dto.email, dto.password);
  }

  /** Admin console login — rejects accounts without a staff role. */
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async loginStaff(@Body() dto: LoginEmailDto) {
    return this.authService.loginStaff(dto.email, dto.password);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  // Phone sign-in — gated behind ENABLE_OTP_LOGIN until an SMS provider is wired up.

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.otp);
  }

  /** Lets a client validate a stored token and rehydrate the session. */
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.validateUserById(user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  async updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    const updated = await this.authService.updateProfile(user.id, dto);
    return { success: true, user: updated };
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: { id: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  /**
   * Right to erasure. Not a DELETE on /auth/me: it takes a password in the
   * body, and a body on DELETE is poorly supported by proxies and clients.
   */
  @Post('close-account')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async closeAccount(@CurrentUser() user: { id: string }, @Body() dto: DeleteAccountDto) {
    return this.authService.deleteOwnAccount(user.id, dto.password, dto.reason);
  }

  @Post('address')
  @UseGuards(AuthGuard)
  async addAddress(@CurrentUser() user: { id: string }, @Body() dto: CreateAddressDto) {
    const addresses = await this.authService.addAddress(user.id, dto);
    return { success: true, addresses };
  }

  // The address id is checked against the caller in the service, so one
  // customer cannot edit or delete another's address by guessing an id.
  @Patch('address/:id')
  @UseGuards(AuthGuard)
  async updateAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const addresses = await this.authService.updateAddress(user.id, id, dto);
    return { success: true, addresses };
  }

  @Delete('address/:id')
  @UseGuards(AuthGuard)
  async deleteAddress(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    const addresses = await this.authService.deleteAddress(user.id, id);
    return { success: true, addresses };
  }
}
