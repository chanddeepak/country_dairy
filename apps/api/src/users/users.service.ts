import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { pageParams, paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 12;

const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.CATALOG_MANAGER,
  Role.ORDER_MANAGER,
  Role.DELIVERY_DRIVER,
];

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    // UsersModule already imports AuthModule, which exports this, so the
    // erasure has one implementation rather than a second copy here that
    // slowly stops matching the first.
    private auth: AuthService,
  ) {}

  // --- Staff accounts ---

  async listStaff() {
    return this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      select: STAFF_SELECT,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async listDrivers() {
    return this.prisma.user.findMany({
      where: { role: Role.DELIVERY_DRIVER, isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    });
  }

  async createStaff(dto: { email: string; name: string; password: string; role: Role }) {
    if (!STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException('That role cannot be assigned to a staff account');
    }

    const email = dto.email.trim().toLowerCase();

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new BadRequestException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role,
        identities: {
          create: { provider: 'EMAIL', providerId: email, verifiedAt: new Date() },
        },
      },
      select: STAFF_SELECT,
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'StaffAccount',
      entityId: user.id,
      after: { email: user.email, name: user.name, role: user.role },
    });

    this.logger.log(`Created staff account ${user.id} (${dto.role})`);
    return user;
  }

  async updateStaff(
    actorId: string,
    userId: string,
    dto: { name?: string; role?: Role; isActive?: boolean },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      throw new NotFoundException('Staff account not found');
    }

    // Guards against an admin locking themselves out, and against removing the
    // last super admin, which would leave nobody able to manage the console.
    if (actorId === userId && (dto.isActive === false || (dto.role && dto.role !== Role.SUPER_ADMIN))) {
      throw new ForbiddenException('You cannot deactivate or demote your own account');
    }

    if (target.role === Role.SUPER_ADMIN && (dto.isActive === false || (dto.role && dto.role !== Role.SUPER_ADMIN))) {
      const remaining = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isActive: true, id: { not: userId } },
      });
      if (remaining === 0) {
        throw new ForbiddenException('At least one active Super Admin must remain');
      }
    }

    if (dto.role && !STAFF_ROLES.includes(dto.role)) {
      throw new BadRequestException('That role cannot be assigned to a staff account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, role: dto.role, isActive: dto.isActive },
      select: STAFF_SELECT,
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'StaffAccount',
      entityId: userId,
      before: { name: target.name, role: target.role, isActive: target.isActive },
      after: { name: updated.name, role: updated.role, isActive: updated.isActive },
    });

    return updated;
  }

  async resetStaffPassword(userId: string, newPassword: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      throw new NotFoundException('Staff account not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });

    // The password itself is never recorded; AuditService redacts it anyway.
    await this.audit.record({
      action: 'PASSWORD_RESET',
      entity: 'StaffAccount',
      entityId: userId,
      after: { email: target.email },
    });

    this.logger.log(`Password reset for staff account ${userId}`);
    return { success: true };
  }

  // --- Customers ---

  async listCustomers(search?: string, paging: { page?: number; pageSize?: number } = {}) {
    const { page, pageSize, skip, take } = pageParams(paging);

    const where = {
        role: Role.CUSTOMER,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
              ],
            }
          : {}),
    };

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          ...STAFF_SELECT,
          walletBalance: true,
          // So the console can tell an erased account from a live one. Without
          // it a closed account still offers an Erase button, which then fails.
          deletedAt: true,
          _count: { select: { orders: true, subscriptions: true, reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Lifetime value per customer, from paid orders only.
    const spend = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { paymentStatus: 'PAID' },
      _sum: { totalAmount: true },
    });
    const spendByUser = new Map(spend.map((s) => [s.userId, Number(s._sum.totalAmount ?? 0)]));

    const items = customers.map((c) => ({
      ...c,
      totalOrders: c._count.orders,
      totalSpent: spendByUser.get(c.id) ?? 0,
    }));

    return paginate(items, total, { page, pageSize });
  }

  async getCustomer(userId: string) {
    const customer = await this.prisma.user.findFirst({
      where: { id: userId, role: Role.CUSTOMER },
      select: {
        ...STAFF_SELECT,
        walletBalance: true,
        deletedAt: true,
        addresses: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }
  /**
   * Erasure, on a customer's behalf. The work belongs to AuthService, which
   * owns the session cache that has to be invalidated with it.
   */
  async eraseCustomer(customerId: string, reason?: string) {
    return this.auth.eraseCustomerAsAdmin(customerId, reason);
  }

}
