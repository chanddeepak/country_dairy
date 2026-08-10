import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    return this.auditService.list({ entity, action, search });
  }

  @Get('filters')
  async filters() {
    return this.auditService.getFilterOptions();
  }
}
