import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role, SupportStatus } from '@prisma/client';
import { SupportService } from './support.service';
import {
  CreateTicketDto,
  GuestTicketDto,
  ReplyDto,
  SetTicketStatusDto,
} from './dto/support.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

/** Who may read the whole inbox rather than only their own thread. */
const SUPPORT_STAFF = [Role.SUPER_ADMIN, Role.ORDER_MANAGER];

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /**
   * The contact form. Public on purpose — the people most likely to have a
   * question are the ones who have not bought anything yet, and a form that
   * demands an account turns exactly those people away.
   */
  @Post('contact')
  async contact(@Body() dto: GuestTicketDto) {
    return this.support.createGuestTicket(dto);
  }

  // --- Staff. Declared before ':id' so "admin" is not read as a ticket id. ---

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...SUPPORT_STAFF)
  async list(
    @Query('status') status?: SupportStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.support.listForStaff({
      status,
      search,
      page: Number(page) || undefined,
      pageSize: Number(pageSize) || undefined,
    });
  }

  @Get('admin/stats')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...SUPPORT_STAFF)
  async stats() {
    return this.support.stats();
  }

  @Get('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...SUPPORT_STAFF)
  async getOne(@Param('id') id: string) {
    return this.support.getForStaff(id);
  }

  @Patch('admin/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(...SUPPORT_STAFF)
  async setStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SetTicketStatusDto,
  ) {
    return this.support.setStatus(id, dto.status, user.id);
  }

  // --- Customer ---

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTicketDto,
  ) {
    return this.support.createTicket(user.id, dto);
  }

  @Get()
  @UseGuards(AuthGuard)
  async mine(@CurrentUser() user: { id: string }) {
    return this.support.listMine(user.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async one(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.support.getOwnTicket(user.id, id);
  }

  /**
   * Both sides post here. The service decides which it is from the caller's
   * role, so a customer cannot post a message that claims to be from staff.
   */
  @Post(':id/reply')
  @UseGuards(AuthGuard)
  async reply(
    @CurrentUser() user: { id: string; role: Role; name?: string },
    @Param('id') id: string,
    @Body() dto: ReplyDto,
  ) {
    return this.support.reply(id, user, dto.body);
  }
}
