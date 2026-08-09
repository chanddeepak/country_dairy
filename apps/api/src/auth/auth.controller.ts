import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import {
  CreateAddressDto,
  GoogleLoginDto,
  LoginEmailDto,
  RegisterEmailDto,
  SendOtpDto,
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

  @Post('address')
  @UseGuards(AuthGuard)
  async addAddress(@CurrentUser() user: { id: string }, @Body() dto: CreateAddressDto) {
    const addresses = await this.authService.addAddress(user.id, dto);
    return { success: true, addresses };
  }
}
