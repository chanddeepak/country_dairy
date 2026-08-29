import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Everything customer-facing is dated in India, wherever the server runs. */
export const BUSINESS_TZ = process.env.REPORTING_TZ || 'Asia/Kolkata';

/**
 * The calendar year in India, not in whatever zone the host happens to use.
 *
 * Render runs UTC, so `new Date().getFullYear()` disagrees with the shop for
 * the first five and a half hours of every year — orders placed at 01:00 IST on
 * 1 January would have carried the previous year.
 */
export function businessYear(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric' }).format(date),
  );
}

/**
 * The Indian financial year, as `2026-27`. April to March.
 *
 * Same timezone reasoning, and it matters more here: an invoice issued at
 * 02:00 IST on 1 April belongs to the new financial year, and a UTC clock would
 * file it under the old one — which is a GST problem, not a cosmetic one.
 */
export function businessFinancialYear(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * Hands out the next number in a named series.
 *
 * Replaces `max(orderNumber) + 1`, which had three faults: it reissued a number
 * after an order was deleted, two simultaneous checkouts could read the same
 * maximum, and past 99,999 it broke for good because the maximum was found with
 * a text sort — 'CD-2026-99999' sorts above 'CD-2026-100000'.
 *
 * **Two ways to allocate, because two callers need different things.**
 *
 * An order number may have gaps; an abandoned checkout leaving a hole costs
 * nothing. A GST invoice number may not — the series must be consecutive for
 * the financial year. That single difference decides where the row lock lives,
 * and it is the whole reason this class has two methods rather than one.
 */
@Injectable()
export class NumberSeriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Allocates in its own transaction, committing immediately.
   *
   * For order numbers. The checkout transaction decrements stock and writes the
   * order, and holding a row lock across all of that would make every customer
   * queue behind the one in front. Committing straight away holds the lock for
   * microseconds instead.
   *
   * The cost is a gap when the checkout that asked for it then fails. That is
   * the right trade for an order number and the wrong one for an invoice.
   */
  async allocate(key: string): Promise<number> {
    return this.next(this.prisma, key);
  }

  /**
   * Allocates inside the caller's transaction, so it rolls back with it.
   *
   * For invoice numbers, where the series must have no holes: if the dispatch
   * fails after taking a number, the number must come back. This does hold the
   * row lock until the caller commits, which serialises concurrent dispatches —
   * accepted deliberately, because gap-free is a legal requirement and dispatch
   * is staff-initiated and low-volume.
   */
  async allocateWithin(tx: Prisma.TransactionClient, key: string): Promise<number> {
    return this.next(tx, key);
  }

  /**
   * One statement, so there is no window between reading and writing.
   *
   * `ON CONFLICT DO UPDATE` makes the increment atomic; a SELECT followed by an
   * UPDATE would reintroduce exactly the race this class exists to remove.
   */
  private async next(
    client: PrismaService | Prisma.TransactionClient,
    key: string,
  ): Promise<number> {
    const rows = await client.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "NumberSeries" ("key", "lastValue", "updatedAt")
      VALUES (${key}, 1, NOW())
      ON CONFLICT ("key") DO UPDATE
        SET "lastValue" = "NumberSeries"."lastValue" + 1, "updatedAt" = NOW()
      RETURNING "lastValue"
    `;
    return Number(rows[0].lastValue);
  }
}
