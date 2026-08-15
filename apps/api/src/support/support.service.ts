import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SupportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { pageParams, paginate } from '../common/pagination';

/** Open first, then the ones waiting on us, then anything settled. */
const INBOX_ORDER: SupportStatus[] = [
  SupportStatus.OPEN,
  SupportStatus.AWAITING_CUSTOMER,
  SupportStatus.RESOLVED,
  SupportStatus.CLOSED,
];

const TICKET_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  order: { select: { id: true, orderNumber: true, status: true, totalAmount: true } },
  messages: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A short human reference, so a customer can quote it on the phone.
   *
   * Sequential within the day rather than globally, which keeps it short. It
   * does not need to be gap-free — this is a label, not an invoice number.
   */
  private async nextRef(): Promise<string> {
    const now = new Date();
    const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}`;

    const todayCount = await this.prisma.supportTicket.count({
      where: { ticketRef: { startsWith: `CD-${day}-` } },
    });

    return `CD-${day}-${String(todayCount + 1).padStart(3, '0')}`;
  }

  async createTicket(
    userId: string,
    input: { subject: string; body: string; orderId?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('Account not found');
    }

    // An order may only be attached by the person who placed it, or a customer
    // could raise a ticket against somebody else's order and read the reply.
    if (input.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: input.orderId, userId },
        select: { id: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketRef: await this.nextRef(),
        userId,
        orderId: input.orderId ?? null,
        subject: input.subject.trim(),
        status: SupportStatus.OPEN,
        messages: {
          create: {
            authorId: userId,
            authorName: user.name ?? 'Customer',
            fromStaff: false,
            body: input.body.trim(),
          },
        },
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(`Support ticket ${ticket.ticketRef} opened`);
    return ticket;
  }

  /**
   * A query from someone who has not signed in.
   *
   * Kept separate from createTicket rather than making userId optional there,
   * so the authenticated path cannot accidentally accept a name and email from
   * a form and attribute a ticket to whoever the sender claims to be.
   */
  async createGuestTicket(input: {
    name: string;
    email: string;
    subject: string;
    body: string;
  }) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketRef: await this.nextRef(),
        userId: null,
        contactName: input.name.trim(),
        contactEmail: input.email.trim().toLowerCase(),
        subject: input.subject.trim(),
        status: SupportStatus.OPEN,
        messages: {
          create: {
            authorId: null,
            authorName: input.name.trim(),
            fromStaff: false,
            body: input.body.trim(),
          },
        },
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(`Support ticket ${ticket.ticketRef} opened from the contact form`);
    return ticket;
  }

  /** Every ticket this customer has raised, newest first. */
  async listMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOwnTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: TICKET_INCLUDE,
    });

    // 404 rather than 403, so ticket ids cannot be probed for existence.
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async reply(
    ticketId: string,
    author: { id: string; role: Role; name?: string | null },
    body: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketRef: true, userId: true, status: true },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    const isStaff = author.role !== Role.CUSTOMER;
    if (!isStaff && ticket.userId !== author.id) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === SupportStatus.CLOSED) {
      throw new BadRequestException(
        'This ticket is closed. Open a new one and quote ' + ticket.ticketRef + '.',
      );
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          ticketId,
          authorId: author.id,
          authorName: author.name ?? (isStaff ? 'Country Dairy' : 'Customer'),
          fromStaff: isStaff,
          body: body.trim(),
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          // A staff reply puts the ball in the customer's court and vice
          // versa, which is what lets the inbox show who is actually waiting.
          status: isStaff ? SupportStatus.AWAITING_CUSTOMER : SupportStatus.OPEN,
          ...(isStaff ? { lastReplyAt: new Date() } : {}),
        },
      }),
    ]);

    return message;
  }

  // --- Staff ---

  async listForStaff(filters: {
    status?: SupportStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { page, pageSize, skip, take } = pageParams(filters);

    const where: Prisma.SupportTicketWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { ticketRef: { contains: filters.search, mode: 'insensitive' as const } },
              { subject: { contains: filters.search, mode: 'insensitive' as const } },
              { user: { name: { contains: filters.search, mode: 'insensitive' as const } } },
              { user: { email: { contains: filters.search, mode: 'insensitive' as const } } },
              { order: { orderNumber: { contains: filters.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    // Prisma orders an enum by its declared position, which happens to be the
    // order we want; sorted explicitly so a schema reshuffle cannot change it.
    items.sort(
      (a, b) => INBOX_ORDER.indexOf(a.status) - INBOX_ORDER.indexOf(b.status),
    );

    return paginate(items, total, { page, pageSize });
  }

  async getForStaff(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: TICKET_INCLUDE,
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async setStatus(ticketId: string, status: SupportStatus, actorId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketRef: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status === status) {
      throw new BadRequestException(`That ticket is already ${status.toLowerCase()}`);
    }

    await this.audit.record({
      action: 'STATUS_CHANGE',
      entity: 'SupportTicket',
      entityId: ticket.ticketRef,
      before: { status: ticket.status },
      after: { status },
    });

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        closedAt:
          status === SupportStatus.CLOSED || status === SupportStatus.RESOLVED
            ? new Date()
            : null,
      },
      include: TICKET_INCLUDE,
    });
  }

  /** Counts for the inbox chips. */
  async stats() {
    const grouped = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: true,
    });

    const counts = Object.fromEntries(
      INBOX_ORDER.map((s) => [s, grouped.find((g) => g.status === s)?._count ?? 0]),
    );

    return { ...counts, total: grouped.reduce((sum, g) => sum + g._count, 0) };
  }
}
