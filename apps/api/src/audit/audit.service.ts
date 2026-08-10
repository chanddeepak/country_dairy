import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { currentActor } from './request-context';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'STATUS_CHANGE'
  | 'LOGIN'
  | 'PASSWORD_RESET'
  | 'TOGGLE';

export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Never written to the log, whatever object is handed in. */
const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'accessToken',
  'token',
  'codeHash',
  'tokenHash',
  'gatewaySignature',
  'razorpaySignature',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Strips secrets and trims large blobs. An audit row is read by a human
   * later; a full base64 image in payloadBefore helps nobody and bloats the
   * table.
   */
  private sanitize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return value;
    if (depth > 4) return '[nested]';

    if (Array.isArray(value)) {
      return value.slice(0, 50).map((v) => this.sanitize(v, depth + 1));
    }

    if (value instanceof Date) return value.toISOString();

    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (REDACTED_KEYS.has(key)) {
          out[key] = '[redacted]';
        } else if (typeof val === 'string' && val.length > 500) {
          out[key] = `${val.slice(0, 500)}… [truncated]`;
        } else {
          out[key] = this.sanitize(val, depth + 1);
        }
      }
      return out;
    }

    return value;
  }

  /**
   * Records a mutation. Deliberately never throws — an audit failure must not
   * roll back or block the business operation it is describing.
   */
  async record(input: AuditInput): Promise<void> {
    const actor = currentActor();

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actor.userId,
          userName: actor.userName ?? 'System',
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          payloadBefore: this.sanitize(input.before) as Prisma.InputJsonValue,
          payloadAfter: this.sanitize(input.after) as Prisma.InputJsonValue,
          ipAddress: actor.ipAddress,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry for ${input.action} ${input.entity}: ${(error as Error).message}`,
      );
    }
  }

  async list(filters: { entity?: string; action?: string; search?: string; take?: number } = {}) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.search
          ? {
              OR: [
                { userName: { contains: filters.search, mode: 'insensitive' as const } },
                { entity: { contains: filters.search, mode: 'insensitive' as const } },
                { entityId: { contains: filters.search } },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.take ?? 100, 500),
    });
  }

  /** Distinct entities and actions present, for populating the filter chips. */
  async getFilterOptions() {
    const [entities, actions] = await Promise.all([
      this.prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true } }),
      this.prisma.auditLog.findMany({ distinct: ['action'], select: { action: true } }),
    ]);

    return {
      entities: entities.map((e) => e.entity).sort(),
      actions: actions.map((a) => a.action).sort(),
    };
  }
}
