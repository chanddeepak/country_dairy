import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body('phone') phone: string) {
    const success = await this.authService.sendOtp(phone);
    return {
      success,
      message: `Verification code dispatched to ${phone}`,
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body('phone') phone: string,
    @Body('otp') otp: string,
  ) {
    const result = await this.authService.verifyOtp(phone, otp);
    return {
      success: true,
      ...result,
    };
  }

  @Post('email/register')
  @HttpCode(HttpStatus.OK)
  async registerWithEmail(
    @Body('email') email: string,
    @Body('password') pass: string,
    @Body('name') name: string,
  ) {
    const result = await this.authService.registerWithEmail(email, pass, name);
    return { success: true, ...result };
  }

  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  async loginWithEmail(
    @Body('email') email: string,
    @Body('password') pass: string,
  ) {
    const result = await this.authService.loginWithEmail(email, pass);
    return { success: true, ...result };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(@Body('idToken') idToken: string) {
    const result = await this.authService.loginWithGoogle(idToken);
    return { success: true, ...result };
  }

  @Post('address')
  @UseGuards(AuthGuard)
  async addAddress(
    @CurrentUser() user: any,
    @Body('line1') line1: string,
    @Body('city') city: string,
    @Body('state') state: string,
    @Body('pincode') pincode: string,
    @Body('phone') phone: string,
  ) {
    const addresses = await this.authService.addAddress(user.id, line1, city, state, pincode, phone);
    return {
      success: true,
      addresses,
    };
  }
}
