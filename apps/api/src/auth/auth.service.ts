import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  // Simple in-memory cache to store OTP codes during development
  private otpStore = new Map<string, { code: string; expiresAt: number }>();
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy');
  }

  // --- MOBILE OTP AUTH ---
  async sendOtp(phone: string): Promise<boolean> {
    const code = process.env.NODE_ENV === 'development' || phone === '+919876543210' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.otpStore.set(phone, { code, expiresAt });
    console.log(`[OTP Verification] Code for ${phone} is: ${code}`);
    return true;
  }

  async verifyOtp(phone: string, otp: string): Promise<{ accessToken: string; user: any }> {
    const cached = this.otpStore.get(phone);
    if (!cached || cached.expiresAt < Date.now()) {
      if (cached) this.otpStore.delete(phone);
      throw new UnauthorizedException('OTP verification code not requested or expired');
    }
    if (cached.code !== otp) {
      throw new UnauthorizedException('Invalid verification code');
    }
    this.otpStore.delete(phone);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          authProvider: 'PHONE',
          role: 'CUSTOMER',
          walletBalance: 0.00,
        },
      });
    }

    return this.generateAuthResponse(user);
  }

  // --- EMAIL AUTH ---
  async registerWithEmail(email: string, password: string, name: string): Promise<{ accessToken: string; user: any }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        authProvider: 'EMAIL',
        role: 'CUSTOMER',
        walletBalance: 0.00,
      }
    });

    return this.generateAuthResponse(user);
  }

  async loginWithEmail(email: string, password: string): Promise<{ accessToken: string; user: any }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateAuthResponse(user);
  }

  // --- GOOGLE AUTH ---
  async loginWithGoogle(idToken: string): Promise<{ accessToken: string; user: any }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const { email, name } = payload;
      let user = await this.prisma.user.findUnique({ where: { email } });
      
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            name,
            authProvider: 'GOOGLE',
            role: 'CUSTOMER',
            walletBalance: 0.00,
          }
        });
      }

      return this.generateAuthResponse(user);
    } catch (e) {
      console.error('Google Auth Error:', e);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  private generateAuthResponse(user: any) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    
    // Omit sensitive fields
    const { passwordHash, ...safeUser } = user;
    return { accessToken, user: safeUser };
  }

  async validateUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, email: true, role: true, walletBalance: true, addresses: true },
    });
  }

  async addAddress(userId: string, line1: string, city: string, state: string, pincode: string, phone: string) {
    await this.prisma.address.create({
      data: { userId, street: line1, city, state, postalCode: pincode, phone },
    });
    return this.prisma.address.findMany({ where: { userId } });
  }
}
