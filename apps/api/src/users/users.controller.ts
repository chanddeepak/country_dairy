import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { CreateStaffDto, EraseCustomerDto, ResetPasswordDto, UpdateStaffDto } from './dto/users.dto';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Staff management (super admin only) ---

  @Get('staff')
  @Roles(Role.SUPER_ADMIN)
  async listStaff() {
    return this.usersService.listStaff();
  }

  @Post('staff')
  @Roles(Role.SUPER_ADMIN)
  async createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaff(dto);
  }

  @Patch('staff/:id')
  @Roles(Role.SUPER_ADMIN)
  async updateStaff(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.usersService.updateStaff(actor.id, id, dto);
  }

  @Patch('staff/:id/password')
  @Roles(Role.SUPER_ADMIN)
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetStaffPassword(id, dto.password);
  }

  /** Drivers available for order assignment. */
  @Get('drivers')
  @Roles(Role.SUPER_ADMIN, Role.ORDER_MANAGER)
  async listDrivers() {
    return this.usersService.listDrivers();
  }

  // --- Customers ---

  @Get('customers')
  @Roles(Role.SUPER_ADMIN, Role.ORDER_MANAGER)
  async listCustomers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.usersService.listCustomers(search, {
      page: Number(page) || undefined,
      pageSize: Number(pageSize) || undefined,
    });
  }

  @Get('customers/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORDER_MANAGER)
  async getCustomer(@Param('id') id: string) {
    return this.usersService.getCustomer(id);
  }

  /**
   * Erase a customer, for the deletion request that arrives by phone or email
   * rather than through the storefront's own form.
   *
   * Super admin only, and deliberately narrower than the read routes above:
   * an order manager needs to see customers to do their job, which is not the
   * same as being able to erase one.
   */
  @Delete('customers/:id')
  @Roles(Role.SUPER_ADMIN)
  async eraseCustomer(@Param('id') id: string, @Body() dto: EraseCustomerDto) {
    return this.usersService.eraseCustomer(id, dto?.reason);
  }
}
