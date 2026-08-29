import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Role, User } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { MESSAGE_CHANNEL } from '../notifications/message-channel';
import type { MessageChannel } from '../notifications/message-channel';
import {
  ChangePasswordDto,
  CreateAddressDto,
  DeleteAccountDto,
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
    @Inject(forwardRef(() => MediaService))
    private media: MediaService,
    private audit: AuditService,
    @Inject(MESSAGE_CHANNEL)
    private messageChannel: MessageChannel,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    /*
     * A fixed OTP is a master key to every account on the site. Refusing to
     * start is the only guard that cannot be skipped by someone not reading
     * the logs — and CASHFREE_ENV=production is the clearest signal available
     * that this instance is taking real money from real customers.
     */
    if (AuthService.DEV_OTP_CODE && process.env.CASHFREE_ENV === 'production') {
      throw new Error(
        'OTP_DEV_CODE is set while CASHFREE_ENV=production. A fixed sign-in code would let ' +
          'anyone into any account. Unset OTP_DEV_CODE before running against live payments.',
      );
    }

    if (AuthService.DEV_OTP_CODE) {
      this.logger.warn(
        'OTP_DEV_CODE is set: every phone sign-in accepts the same fixed code. ' +
          'Never set this where real customers can reach it.',
      );
    }
  }

  // --- EMAIL + PASSWORD ---

  /** Registration follows the same switch: no new email-and-password accounts. */
  async registerWithEmail(email: string, password: string, name: string) {
    if (!(await this.featureFlags.isEnabled(FLAG.EMAIL_LOGIN))) {
      throw new ForbiddenException(
        'Accounts are created with a mobile number now. Please sign in with yours.',
      );
    }

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
    /*
     * Behind the flag on the server, not only in the storefront.
     *
     * Hiding the form left the endpoint answering, so "email sign-in is off"
     * was true of the page and false of the API — anyone with the old form
     * cached, a bookmark, or curl could still sign in.
     *
     * Staff are not affected: the console uses loginStaff, which is a separate
     * path precisely so a customer-facing switch cannot lock the desk out.
     */
    if (!(await this.featureFlags.isEnabled(FLAG.EMAIL_LOGIN))) {
      throw new ForbiddenException(
        'Email sign-in is no longer available. Please sign in with your mobile number.',
      );
    }

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
  // Behind ENABLE_OTP_LOGIN. The codes are stored hashed in OtpVerification
  // rather than in memory, so this works across instances and survives a
  // redeploy.

  /** Per phone, per quarter hour. Stops a customer hammering Resend. */
  private static readonly OTP_PER_PHONE = 5;
  /** Per IP, per hour. Stops one attacker cycling numbers. */
  private static readonly OTP_PER_IP = 10;
  /**
   * Everyone, per day. The last line: a distributed attack defeats both limits
   * above, and every request past this point is money. Deliberately generous
   * enough that real traffic never reaches it, and finite so a bill cannot run
   * away overnight.
   */
  private static readonly OTP_PER_DAY = Number(process.env.OTP_DAILY_LIMIT ?? 500);

  /**
   * A fixed sign-in code, for walking the flow before a message channel exists.
   *
   * Every account on the site can be entered by anyone who knows this string
   * and a mobile number, so it is guarded rather than merely discouraged: the
   * application refuses to boot with it set alongside production Cashfree
   * credentials (see the constructor), and every use is logged as a warning so
   * it cannot sit in an environment unnoticed.
   *
   * Delete the variable and real random codes resume with no other change.
   */
  private static readonly DEV_OTP_CODE = process.env.OTP_DEV_CODE;

  async sendOtp(phone: string, requestIp?: string): Promise<{ success: boolean }> {
    await this.assertOtpEnabled();

    const now = Date.now();
    const since = (ms: number) => ({ gt: new Date(now - ms) });

    const [perPhone, perIp, perDay] = await Promise.all([
      this.prisma.otpVerification.count({
        where: { phone, createdAt: since(15 * 60 * 1000) },
      }),
      requestIp
        ? this.prisma.otpVerification.count({
            where: { requestIp, createdAt: since(60 * 60 * 1000) },
          })
        : Promise.resolve(0),
      this.prisma.otpVerification.count({ where: { createdAt: since(24 * 60 * 60 * 1000) } }),
    ]);

    if (perPhone >= AuthService.OTP_PER_PHONE || perIp >= AuthService.OTP_PER_IP) {
      // One message for both, on purpose. Telling a caller which limit they hit
      // tells them how to stay under the other one.
      throw new BadRequestException('Too many verification attempts. Try again later.');
    }

    if (perDay >= AuthService.OTP_PER_DAY) {
      this.logger.error(
        `Daily OTP ceiling of ${AuthService.OTP_PER_DAY} reached — sign-in is refusing everyone. ` +
          'Either traffic has grown or someone is cycling numbers.',
      );
      throw new BadRequestException('Verification is temporarily unavailable. Please try again later.');
    }

    const code = AuthService.DEV_OTP_CODE ?? Math.floor(100000 + Math.random() * 900000).toString();

    if (AuthService.DEV_OTP_CODE) {
      this.logger.warn(`Fixed OTP_DEV_CODE issued for ${phone} — not a real verification`);
    }

    await this.prisma.otpVerification.create({
      data: {
        phone,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(now + 5 * 60 * 1000),
        requestIp,
      },
    });

    // The row is written before the send, so a provider failure still counts
    // against the limits above. A send that throws must not also be free.
    await this.messageChannel.sendOtp(phone, code);

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

  /**
   * Signs in the holder of a phone number that somebody else verified.
   *
   * Used after a guest pays: Cashfree ran its own OTP before taking the money,
   * so the number is proven — just not by us. Everything else is the ordinary
   * phone path, including find-or-create, so a returning customer lands on the
   * account they already had rather than a second one.
   *
   * Deliberately not behind ENABLE_OTP_LOGIN. That flag governs whether *we*
   * send codes; this session comes from a completed payment, and refusing it
   * would take money and then leave the buyer with no way to see the order.
   *
   * The caller must have verified the phone with the gateway. Nothing here can
   * check that, which is why it is not reachable from a controller.
   */
  async signInByVerifiedPhone(
    phone: string,
    profile?: { email?: string | null; name?: string | null },
  ) {
    /*
     * Note what is NOT passed to resolveUserForIdentity: the email.
     *
     * That function looks up by email first when it has one, and the phone is
     * the only thing verified here — matching on an email instead could attach
     * a stranger's order to whoever happens to own that address. So the lookup
     * stays keyed on the phone, and contact details are filled in afterwards.
     */
    const user = await this.resolveUserForIdentity(AuthProvider.PHONE, phone, { phone });
    const enriched = await this.fillMissingContactDetails(user, profile);
    await this.touchLastLogin(enriched.id);
    return this.buildAuthResponse(enriched);
  }

  /**
   * Adds a name or email to an account that has none.
   *
   * Only fills gaps — never overwrites. What the customer has already told us
   * outranks anything a gateway hands back, and a checkout address may well be
   * somebody else's (a gift, an office) rather than the account holder's.
   */
  private async fillMissingContactDetails(
    user: User,
    profile?: { email?: string | null; name?: string | null },
  ): Promise<User> {
    if (!profile) return user;

    const data: { email?: string; name?: string } = {};

    const name = profile.name?.trim();
    if (!user.name && name) data.name = name;

    const email = profile.email?.trim().toLowerCase();
    if (!user.email && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // User.email is unique, so writing one that already belongs to somebody
      // else would throw — and quietly claiming their address would be worse.
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken) {
        this.logger.warn(
          `Not attaching ${email} to user ${user.id}: another account already uses it`,
        );
      } else {
        data.email = email;
      }
    }

    if (Object.keys(data).length === 0) return user;

    this.logger.log(`Filled in ${Object.keys(data).join(' and ')} for user ${user.id}`);
    return this.prisma.user.update({ where: { id: user.id }, data });
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
        // Without these the account page cannot show which channels the
        // customer has agreed to — the toggles would render off whatever
        // they had actually chosen.
        emailOptIn: true,
        smsOptIn: true,
        whatsappOptIn: true,
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
        ...(dto.emailOptIn !== undefined ? { emailOptIn: dto.emailOptIn } : {}),
        ...(dto.smsOptIn !== undefined ? { smsOptIn: dto.smsOptIn } : {}),
        ...(dto.whatsappOptIn !== undefined ? { whatsappOptIn: dto.whatsappOptIn } : {}),
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

  /**
   * Right to erasure under the DPDP Act 2023.
   *
   * Two obligations pull against each other. The customer may demand their
   * personal data be erased; the Companies Act and GST rules require the
   * invoice — including the buyer's name and the place of supply — to be kept
   * for years. So the row survives with its financial history intact and every
   * identifying field cleared, rather than being deleted outright.
   *
   * Kept: orders, order lines, payments, and enough of the shipping address to
   * establish place of supply (city, state, PIN), because that is what decides
   * whether the tax on a past invoice was CGST+SGST or IGST.
   *
   * Erased: name, email, phone, saved addresses, cart, reviews and their
   * photographs, sign-in identities, and the street address on past orders.
   */
  /**
   * The erasure itself.
   *
   * Shared by the customer closing their own account and by a super admin
   * doing it on their behalf, because two erasures written separately drift,
   * and the way you find out is a regulator asking why a name is still in the
   * database. The callers differ only in how they establish the right to do
   * it: the customer proves it with their password, the super admin with
   * their role.
   */
  private async eraseCustomerRecord(userId: string, reason?: string) {
    const reviews = await this.prisma.productReview.findMany({
      where: { userId },
      select: { id: true, mediaUrls: true },
    });

    const orders = await this.prisma.order.findMany({
      where: { userId },
      select: { id: true, shippingAddress: true },
    });

    // Strip the street and the person from each order's address snapshot, but
    // keep what the tax treatment depends on.
    const redactions = orders.map((order) => {
      const a = (order.shippingAddress ?? {}) as Record<string, unknown>;
      return this.prisma.order.update({
        where: { id: order.id },
        data: {
          shippingAddress: {
            line1: '[erased at customer request]',
            line2: '',
            city: typeof a.city === 'string' ? a.city : '',
            state: typeof a.state === 'string' ? a.state : '',
            postalCode: typeof a.postalCode === 'string' ? a.postalCode : '',
            country: typeof a.country === 'string' ? a.country : 'India',
            phone: '',
          },
          customerNote: null,
        },
      });
    });

    const tickets = await this.prisma.supportTicket.count({ where: { userId } });
    const closedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.productReview.deleteMany({ where: { userId } }),
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.cartItem.deleteMany({ where: { userId } }),
      this.prisma.authIdentity.deleteMany({ where: { userId } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      // Support came along after this function was first written, and until
      // this line a closed account left the customer's own words behind under
      // their own name. Messages go with the thread — the relation cascades.
      this.prisma.supportTicket.deleteMany({ where: { userId } }),
      ...redactions,
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: 'Closed account',
          // Nulled rather than tombstoned: email and phone are unique, and a
          // person who returns should be able to sign up again with their own
          // address.
          email: null,
          phone: null,
          passwordHash: null,
          isActive: false,
          deletedAt: closedAt,
          emailOptIn: false,
          smsOptIn: false,
          whatsappOptIn: false,
        },
      }),
    ]);

    // Attachments live in object storage, not the database, so they need
    // removing separately or they outlive the account that owned them.
    for (const review of reviews) {
      for (const url of review.mediaUrls) {
        await this.media.deleteMediaFile(url).catch(() => undefined);
      }
    }

    // Otherwise a token minted before the erasure keeps working, because the
    // guard reads this cache rather than the row it was built from.
    this.userCache.delete(userId);

    return {
      reviewsRemoved: reviews.length,
      ordersRedacted: orders.length,
      ticketsRemoved: tickets,
      reason: reason ?? null,
    };
  }

  async deleteOwnAccount(userId: string, password: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, role: true, deletedAt: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException('This account has already been closed');
    }

    // Staff accounts are removed by a super admin through user management, so
    // this route cannot be used to delete the last administrator.
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Staff accounts are closed from the admin console');
    }

    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('That password is not correct');
    }

    const summary = await this.eraseCustomerRecord(userId, reason);

    await this.audit.record({
      action: 'DELETE',
      entity: 'User',
      entityId: userId,
      before: { role: user.role },
      after: { closed: true, ...summary },
    });

    this.logger.log(
      `Account ${userId} closed on request: ${summary.reviewsRemoved} reviews removed, ` +
        `${summary.ordersRedacted} orders redacted, ${summary.ticketsRemoved} queries removed`,
    );

    return {
      success: true as const,
      ordersRetained: summary.ordersRedacted,
      message:
        'Your account is closed and your personal details have been erased. ' +
        'Invoices for past orders are kept because tax law requires it.',
    };
  }

  /**
   * The same erasure, asked for by phone or email and carried out by a super
   * admin — which in practice is how most such requests arrive.
   *
   * There is no password to check here, so the guard is the role plus the
   * audit entry: erasure cannot be undone, and one person doing it to another
   * has to leave a record of who and why that outlives what it destroyed.
   */
  async eraseCustomerAsAdmin(customerId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true, deletedAt: true, email: true, name: true },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException('This account has already been closed');
    }

    // Colleagues are removed through staff management, which has its own
    // guard against deleting the last administrator. Without this check that
    // guard could be walked around by way of the customer route.
    if (user.role !== Role.CUSTOMER) {
      throw new BadRequestException(
        'This is a staff account. Staff are removed from user management.',
      );
    }

    const summary = await this.eraseCustomerRecord(customerId, reason);

    await this.audit.record({
      action: 'DELETE',
      entity: 'User',
      entityId: customerId,
      before: { role: user.role, email: user.email },
      after: { closed: true, erasedByStaff: true, ...summary },
    });

    this.logger.log(
      `Customer ${customerId} erased by staff: ${summary.reviewsRemoved} reviews removed, ` +
        `${summary.ordersRedacted} orders redacted, ${summary.ticketsRemoved} queries removed`,
    );

    return {
      success: true as const,
      ordersRetained: summary.ordersRedacted,
      message:
        'The customer\'s personal details have been erased. Their past orders are ' +
        'kept, with the address redacted, because tax law requires the invoice.',
    };
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
