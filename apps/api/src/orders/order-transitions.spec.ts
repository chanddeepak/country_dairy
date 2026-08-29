import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The order state machine, and the copy of it in the admin console.
 *
 * The console holds its own table so it can grey out transitions the server
 * would refuse. That is the right idea and a standing hazard: the two drifted,
 * and the desk got "Cannot move an order from CONFIRMED to SHIPPED" while
 * entering a waybill, because the consignment page dispatches straight to
 * SHIPPED and the server insisted on PROCESSING first.
 *
 * Parsing the admin file is unlovely, but the alternative is a shared package
 * for seven lines of data, and the failure this catches is a customer's parcel
 * not going out.
 */

function parseTable(source: string): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  const body = source.slice(source.indexOf('{'), source.indexOf('};') + 1);
  for (const [, status, list] of body.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    table[status] = list
      .split(',')
      .map((v) => v.trim().replace(/^OrderStatus\./, '').replace(/['"]/g, ''))
      .filter(Boolean);
  }
  return table;
}

const apiTable = parseTable(
  readFileSync(join(__dirname, 'orders.service.ts'), 'utf8').split('ALLOWED_TRANSITIONS')[1],
);
const adminTable = parseTable(
  readFileSync(
    join(__dirname, '../../../admin/src/pages/Orders.tsx'),
    'utf8',
    // The console calls its copy NEXT_STATUSES.
  ).split('NEXT_STATUSES')[1],
);

describe('order transitions', () => {
  it('lets the consignment desk dispatch a confirmed order', () => {
    // The bug this file exists for: a waybill is entered against a CONFIRMED
    // order, and nothing reads PROCESSING, so requiring it first was a click
    // with no consumer and an error message for the desk.
    expect(apiTable.CONFIRMED).toContain('SHIPPED');
  });

  it('still refuses the transitions that would be nonsense', () => {
    expect(apiTable.DELIVERED).not.toContain('PENDING');
    expect(apiTable.CANCELLED).toEqual([]);
    expect(apiTable.RETURNED).toEqual([]);
    // An unpaid order must be confirmed before it can go anywhere.
    expect(apiTable.PENDING).not.toContain('SHIPPED');
  });

  it('matches the copy the admin console greys buttons out with', () => {
    // Compared whole rather than per key, so a failure prints both tables and
    // shows which row drifted. Jest's expect takes no message argument.
    expect(adminTable).toEqual(apiTable);
  });
});
