import { Controller, Post, UseGuards } from '@nestjs/common';
import { CronGuard } from '../common/cron.guard';
import { OrdersService } from './orders.service';

/**
 * The scheduled half of order housekeeping.
 *
 * A controller of its own because OrdersController carries a class-level
 * AuthGuard, and a method-level guard adds to that rather than replacing it —
 * so a cron route declared there would need a staff JWT as well as the secret,
 * which is the thing this exists to avoid.
 */
@Controller('orders/cron')
export class OrdersCronController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Frees stock held by checkouts that were never paid for.
   *
   * The staff route does the same work, but it sits behind a JWT that expires
   * in a week; a scheduler holding one stops working on day eight and nobody
   * notices until stock has been held for a month. This takes a shared secret
   * that does not expire and grants nothing else.
   *
   * No body on purpose. The window is the server's to choose, so there is no
   * parameter a caller can widen to turn a routine ping into a mass
   * cancellation.
   */
  @Post('expire-abandoned')
  @UseGuards(CronGuard)
  async expireAbandoned() {
    return this.ordersService.expireAbandonedOrders();
  }
}
