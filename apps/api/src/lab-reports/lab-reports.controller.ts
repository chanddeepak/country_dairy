import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LabReportsService } from './lab-reports.service';
import { CreateLabReportDto, UpdateLabReportDto } from './dto/lab-report.dto';

const LAB_STAFF = [Role.SUPER_ADMIN, Role.CATALOG_MANAGER] as const;

@Controller('lab-reports')
export class LabReportsController {
  constructor(private readonly labReports: LabReportsService) {}

  // --- Public ---

  /**
   * Storefront proof-of-purity block. Published reports only — an unpublished
   * batch must not be readable by guessing the product id.
   */
  @Get('product/:productId')
  async listForProduct(@Param('productId') productId: string) {
    return this.labReports.listPublished(productId);
  }

  /** What the QR code on the jar resolves to. */
  @Get('batch/:batchNumber')
  async getByBatch(@Param('batchNumber') batchNumber: string) {
    return this.labReports.findByBatch(batchNumber);
  }

  // --- Console ---

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...LAB_STAFF)
  async listAdmin(@Query('productId') productId?: string) {
    return this.labReports.listForAdmin(productId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...LAB_STAFF)
  async create(@Body() dto: CreateLabReportDto) {
    return this.labReports.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...LAB_STAFF)
  async update(@Param('id') id: string, @Body() dto: UpdateLabReportDto) {
    return this.labReports.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...LAB_STAFF)
  async remove(@Param('id') id: string) {
    return this.labReports.remove(id);
  }
}
