import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CreateAddressDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

// Roles allowed to sign in to the admin console.
const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.CATALOG_MANAGER,
  Role.ORDER_MANAGER,
  Role.DELIVERY_DRIVER,
];

type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private featureFlags: FeatureFlagsService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // --- EMAIL + PASSWORD ---

  async registerWithEmail(email: string, password: string, name: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        role: Role.CUSTOMER,
        identities: {
          create: {
            provider: AuthProvider.EMAIL,
            providerId: normalizedEmail,
            verifiedAt: new Date(),
          },
        },
      },
    });

    this.logger.log(`Registered customer ${user.id}`);
    return this.buildAuthResponse(user);
  }

  async loginWithEmail(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Same error for "no such user" and "wrong password" so the response
    // cannot be used to enumerate registered addresses.
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    await this.touchLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  /**
   * Admin console login. Separate from the customer path so that a customer
   * account can never receive a staff token, whatever its stored role.
   */
  async loginStaff(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!STAFF_ROLES.includes(user.role)) {
      this.logger.warn(`Non-staff account ${user.id} attempted admin login`);
      throw new ForbiddenException('This account cannot access the admin console');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    await this.touchLastLogin(user.id);
    this.logger.log(`Staff login: ${user.id} (${user.role})`);
    return this.buildAuthResponse(user);
  }

  // --- PHONE OTP ---
  //
  // Behind ENABLE_OTP_LOGIN and not yet wired to an SMS provider. The codes
  // are stored hashed in OtpVerification rather than in memory, so this works
  // across instances and survives a redeploy once a provider is connected.

  async sendOtp(phone: string): Promise<{ success: boolean }> {
    await this.assertOtpEnabled();

    const recentCount = await this.prisma.otpVerification.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
    });

    if (recentCount >= 5) {
      throw new BadRequestException('Too many verification attempts. Try again later.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await this.prisma.otpVerification.create({
      data: {
        phone,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // TODO: dispatch via MSG91 once the SMS provider is configured.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[dev] OTP for ${phone} is ${code}`);
    }

    return { success: true };
  }

  async verifyOtp(phone: string, code: string) {
    await this.assertOtpEnabled();

    const record = await this.prisma.otpVerification.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.attempts >= 5) {
      throw new UnauthorizedException('Verification code expired or not requested');
    }

    if (!(await bcrypt.compare(code, record.codeHash))) {
      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.prisma.otpVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const user = await this.resolveUserForIdentity(AuthProvider.PHONE, phone, { phone });
    await this.touchLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  private async assertOtpEnabled() {
    if (!(await this.featureFlags.isEnabled(FLAG.OTP_LOGIN))) {
      throw new ForbiddenException('Phone sign-in is currently unavailable');
    }
  }

  // --- GOOGLE ---

  async loginWithGoogle(idToken: string) {
    if (!(await this.featureFlags.isEnabled(FLAG.GOOGLE_LOGIN))) {
      throw new ForbiddenException('Google sign-in is currently unavailable');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (e) {
      this.logger.warn(`Google token verification failed: ${(e as Error).message}`);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.resolveUserForIdentity(AuthProvider.GOOGLE, payload.sub, {
      email: payload.email.toLowerCase(),
      name: payload.name,
    });

    await this.touchLastLogin(user.id);
    return this.buildAuthResponse(user);
  }

  /**
   * Finds the user behind a provider identity, linking it to an existing
   * account where one already owns the same email.
   *
   * Without this, signing up by one method and later signing in by another
   * silently created a second account with its own wallet and order history.
   */
  private async resolveUserForIdentity(
    provider: AuthProvider,
    providerId: string,
    profile: { email?: string; phone?: string; name?: string },
  ): Promise<User> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });

    if (identity) {
      if (!identity.user.isActive) {
        throw new ForbiddenException('This account has been deactivated');
      }
      return identity.user;
    }

    const existing = profile.email
      ? await this.prisma.user.findUnique({ where: { email: profile.email } })
      : profile.phone
        ? await this.prisma.user.findUnique({ where: { phone: profile.phone } })
        : null;

    if (existing) {
      if (!existing.isActive) {
        throw new ForbiddenException('This account has been deactivated');
      }
      await this.prisma.authIdentity.create({
        data: { userId: existing.id, provider, providerId, verifiedAt: new Date() },
      });
      this.logger.log(`Linked ${provider} identity to existing user ${existing.id}`);
      return existing;
    }

    return this.prisma.user.create({
      data: {
        email: profile.email,
        phone: profile.phone,
        name: profile.name,
        role: Role.CUSTOMER,
        identities: {
          create: { provider, providerId, verifiedAt: new Date() },
        },
      },
    });
  }

  // --- SHARED ---

  private async touchLastLogin(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  private buildAuthResponse(user: User): { accessToken: string; user: SafeUser } {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
      email: user.email,
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { accessToken, user: safeUser };
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
        isActive: true,
        walletBalance: true,
        addresses: true,
      },
    });
  }

  // --- ADDRESSES ---

  async addAddress(userId: string, dto: CreateAddressDto) {
    const existingCount = await this.prisma.address.count({ where: { userId } });
    const shouldBeDefault = existingCount === 0 || dto.isDefault === true;

    if (shouldBeDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    await this.prisma.address.create({
      data: {
        ...dto,
        userId,
        // First address a customer saves becomes their default.
        isDefault: shouldBeDefault,
      },
    });

    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }
}
