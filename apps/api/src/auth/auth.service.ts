import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  ChangePasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from './dto/auth.dto';

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

  /**
   * Cached briefly because AuthGuard calls this on every authenticated
   * request, and each call was a round trip to the remote pooler — roughly
   * 1.2s of the ~1.9s an authenticated endpoint took.
   *
   * The window is deliberately short: a deactivated or deleted account still
   * loses access within seconds, which is the property the guard exists for.
   */
  private userCache = new Map<string, { at: number; user: Awaited<ReturnType<AuthService['loadUserById']>> }>();

  private static readonly USER_CACHE_TTL_MS = 10_000;

  async validateUserById(userId: string) {
    const cached = this.userCache.get(userId);
    if (cached && Date.now() - cached.at < AuthService.USER_CACHE_TTL_MS) {
      return cached.user;
    }

    const user = await this.loadUserById(userId);
    this.userCache.set(userId, { at: Date.now(), user });
    return user;
  }

  /** Drops the cache so a role or status change takes effect immediately. */
  invalidateUser(userId: string) {
    this.userCache.delete(userId);
  }

  private async loadUserById(userId: string) {
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.phone) {
      // phone is unique on User, so a clash must be reported as a conflict
      // rather than surfacing as a raw Prisma error.
      const clash = await this.prisma.user.findFirst({
        where: { phone: dto.phone, id: { not: userId } },
        select: { id: true },
      });

      if (clash) {
        throw new BadRequestException('That mobile number is already on another account');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });

    // The cached copy would otherwise serve the old name for up to 10s.
    this.userCache.delete(userId);

    this.logger.log(`Profile updated for ${userId}`);
    return this.validateUserById(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      // A Google-only account has no password to change.
      throw new BadRequestException('This account does not sign in with a password');
    }

    // Requiring the current password is what stops a stolen session from
    // locking the real owner out of their own account.
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Your current password is not correct');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('The new password must be different');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });

    this.userCache.delete(userId);
    this.logger.log(`Password changed for ${userId}`);

    return { success: true as const };
  }

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

    return this.listAddresses(userId);
  }

  private listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** Confirms the address belongs to the caller before touching it. */
  private async ownAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.ownAddress(userId, addressId);

    // Only one default at a time, so promoting this one demotes the rest.
    if (dto.isDefault === true) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    await this.prisma.address.update({ where: { id: addressId }, data: dto });

    this.logger.log(`Address ${addressId} updated`);
    return this.listAddresses(userId);
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.ownAddress(userId, addressId);

    // Orders reference the address with onDelete: SetNull and carry their own
    // snapshot, so deleting one never rewrites or orphans order history.
    const deleted = await this.prisma.address.delete({ where: { id: addressId } });

    // Never leave a customer with addresses but no default — checkout picks
    // the default, and none selected means an empty form every time.
    if (deleted.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    this.logger.log(`Address ${addressId} deleted`);
    return this.listAddresses(userId);
  }
}
