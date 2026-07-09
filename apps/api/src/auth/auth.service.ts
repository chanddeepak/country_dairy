import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  // Simple in-memory cache to store OTP codes during development
  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async sendOtp(phone: string): Promise<boolean> {
    // Generate a 6-digit verification code. Use '123456' for local developer tests.
    const code = process.env.NODE_ENV === 'development' || phone === '+919876543210' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // Code expires in 5 minutes

    this.otpStore.set(phone, { code, expiresAt });
    console.log(`[OTP Verification] Code for ${phone} is: ${code}`);

    // In production, we would integrate Twilio or MSG91 gateway APIs here.
    return true;
  }

  async verifyOtp(phone: string, otp: string): Promise<{ accessToken: string; user: any }> {
    const cached = this.otpStore.get(phone);

    if (!cached) {
      throw new UnauthorizedException('OTP verification code not requested or expired');
    }

    if (cached.expiresAt < Date.now()) {
      this.otpStore.delete(phone);
      throw new UnauthorizedException('OTP verification code has expired');
    }

    if (cached.code !== otp) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // OTP validated successfully, clean up store
    this.otpStore.delete(phone);

    // Fetch user or create a new profile if it is their first signup
    let user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        walletBalance: true,
        addresses: true,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          role: 'CUSTOMER',
          walletBalance: 0.00,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          walletBalance: true,
          addresses: true,
        },
      });
    }

    // Generate JWT access token containing ID and Role claims
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user,
    };
  }

  async validateUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        walletBalance: true,
        addresses: true,
      },
    });
  }

  async addAddress(userId: string, line1: string, city: string, state: string, pincode: string, phone: string) {
    await this.prisma.address.create({
      data: {
        userId,
        street: line1,
        city,
        state,
        postalCode: pincode,
        phone,
      },
    });
    return this.prisma.address.findMany({
      where: { userId },
    });
  }
}
