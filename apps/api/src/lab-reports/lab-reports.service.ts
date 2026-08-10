import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import {
  CreateLabReportDto,
  LabParameterDto,
  UpdateLabReportDto,
} from './dto/lab-report.dto';

/** Shape returned to both the console and the storefront. */
export interface LabReportView {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  batchNumber: string;
  testDate: string;
  labName: string | null;
  fileUrl: string | null;
  notes: string | null;
  parameters: LabParameterDto[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

type LabReportRow = Prisma.LabReportGetPayload<{
  include: { product: { select: { title: true; slug: true } } };
}>;

const WITH_PRODUCT = {
  product: { select: { title: true, slug: true } },
} satisfies Prisma.LabReportInclude;

/**
 * `parameters` is Json, so anything could be in a row written before this
 * shape existed. Rows that do not match are dropped rather than rendered as
 * "undefined: undefined" on a page whose whole purpose is credibility.
 */
function readParameters(value: Prisma.JsonValue): LabParameterDto[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name.trim()) return [];

    return [
      {
        name: row.name,
        value: typeof row.value === 'string' ? row.value : String(row.value ?? ''),
        standard: typeof row.standard === 'string' ? row.standard : undefined,
        passed: typeof row.passed === 'boolean' ? row.passed : undefined,
      },
    ];
  });
}

@Injectable()
export class LabReportsService {
  private readonly logger = new Logger(LabReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  private toView(row: LabReportRow): LabReportView {
    return {
      id: row.id,
      productId: row.productId,
      productTitle: row.product.title,
      productSlug: row.product.slug,
      batchNumber: row.batchNumber,
      testDate: row.testDate.toISOString(),
      labName: row.labName,
      fileUrl: row.fileUrl,
      notes: row.notes,
      parameters: readParameters(row.parameters),
      isPublished: row.isPublished,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Console listing: every report, newest batch first. */
  async listForAdmin(productId?: string): Promise<LabReportView[]> {
    const rows = await this.prisma.labReport.findMany({
      where: productId ? { productId } : undefined,
      include: WITH_PRODUCT,
      orderBy: [{ testDate: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toView(row));
  }

  /** Storefront: published reports only. */
  async listPublished(productId: string): Promise<LabReportView[]> {
    const rows = await this.prisma.labReport.findMany({
      where: { productId, isPublished: true },
      include: WITH_PRODUCT,
      orderBy: { testDate: 'desc' },
    });

    return rows.map((row) => this.toView(row));
  }

  /**
   * Batch lookup for the QR code printed on the jar. Unpublished batches are
   * invisible here too, so scanning a label cannot expose a held-back result.
   */
  async findByBatch(batchNumber: string): Promise<LabReportView> {
    const row = await this.prisma.labReport.findFirst({
      where: { batchNumber: batchNumber.trim(), isPublished: true },
      include: WITH_PRODUCT,
    });

    if (!row) {
      throw new NotFoundException(`No published lab report for batch "${batchNumber}"`);
    }

    return this.toView(row);
  }

  async create(dto: CreateLabReportDto): Promise<LabReportView> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, title: true },
    });

    if (!product) {
      throw new NotFoundException('That product no longer exists');
    }

    const batchNumber = dto.batchNumber.trim().toUpperCase();

    const clash = await this.prisma.labReport.findUnique({
      where: { productId_batchNumber: { productId: dto.productId, batchNumber } },
      select: { id: true },
    });

    if (clash) {
      throw new ConflictException(
        `${product.title} already has a report for batch ${batchNumber}`,
      );
    }

    const created = await this.prisma.labReport.create({
      data: {
        productId: dto.productId,
        batchNumber,
        testDate: new Date(dto.testDate),
        labName: dto.labName?.trim() || null,
        fileUrl: dto.fileUrl || null,
        notes: dto.notes?.trim() || null,
        parameters: (dto.parameters ?? []) as unknown as Prisma.InputJsonValue,
        isPublished: dto.isPublished ?? true,
      },
      include: WITH_PRODUCT,
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'LabReport',
      entityId: created.id,
      after: { batchNumber, productId: dto.productId, isPublished: created.isPublished },
    });

    this.logger.log(`Lab report created for ${product.title} batch ${batchNumber}`);
    return this.toView(created);
  }

  async update(id: string, dto: UpdateLabReportDto): Promise<LabReportView> {
    const existing = await this.prisma.labReport.findUnique({
      where: { id },
      include: WITH_PRODUCT,
    });

    if (!existing) {
      throw new NotFoundException('That lab report no longer exists');
    }

    const batchNumber = dto.batchNumber?.trim().toUpperCase();

    if (batchNumber && batchNumber !== existing.batchNumber) {
      const clash = await this.prisma.labReport.findUnique({
        where: {
          productId_batchNumber: { productId: existing.productId, batchNumber },
        },
        select: { id: true },
      });

      if (clash) {
        throw new ConflictException(
          `${existing.product.title} already has a report for batch ${batchNumber}`,
        );
      }
    }

    const updated = await this.prisma.labReport.update({
      where: { id },
      data: {
        ...(batchNumber ? { batchNumber } : {}),
        ...(dto.testDate ? { testDate: new Date(dto.testDate) } : {}),
        ...(dto.labName !== undefined ? { labName: dto.labName.trim() || null } : {}),
        ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.parameters !== undefined
          ? { parameters: dto.parameters as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
      include: WITH_PRODUCT,
    });

    // A replaced PDF leaves the old object orphaned in the bucket otherwise.
    if (dto.fileUrl !== undefined && existing.fileUrl && existing.fileUrl !== updated.fileUrl) {
      await this.media.deleteMediaFile(existing.fileUrl);
    }

    await this.audit.record({
      action: 'UPDATE',
      entity: 'LabReport',
      entityId: id,
      before: {
        batchNumber: existing.batchNumber,
        isPublished: existing.isPublished,
        fileUrl: existing.fileUrl,
      },
      after: {
        batchNumber: updated.batchNumber,
        isPublished: updated.isPublished,
        fileUrl: updated.fileUrl,
      },
    });

    return this.toView(updated);
  }

  async remove(id: string): Promise<{ success: true }> {
    const existing = await this.prisma.labReport.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('That lab report no longer exists');
    }

    await this.prisma.labReport.delete({ where: { id } });

    if (existing.fileUrl) {
      await this.media.deleteMediaFile(existing.fileUrl);
    }

    await this.audit.record({
      action: 'DELETE',
      entity: 'LabReport',
      entityId: id,
      before: { batchNumber: existing.batchNumber, productId: existing.productId },
    });

    this.logger.log(`Lab report deleted: batch ${existing.batchNumber}`);
    return { success: true };
  }
}
