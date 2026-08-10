/**
 * Reporting day boundaries.
 *
 * The store sells in India, so a "day" on the dashboard is an IST day. Pure
 * functions kept separate from the service so the bucketing can be tested
 * without a database — grouping in UTC previously pushed evening IST activity
 * into the next bucket and rendered an all-zero chart.
 */

export const REPORTING_TZ = process.env.REPORTING_TZ || 'Asia/Kolkata';
export const REPORTING_TZ_OFFSET = process.env.REPORTING_TZ_OFFSET || '+05:30';

const DAY_MS = 86_400_000;

/** YYYY-MM-DD for the given instant, in the reporting timezone. */
export function reportingDateKey(date: Date): string {
  // en-CA renders as YYYY-MM-DD.
  return date.toLocaleDateString('en-CA', { timeZone: REPORTING_TZ });
}

/** The instant at which the given reporting day begins. */
export function startOfReportingDay(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${REPORTING_TZ_OFFSET}`);
}

/**
 * Consecutive day keys ending today, oldest first. Used to zero-fill the
 * series so a quiet day renders as a gap in the line rather than vanishing.
 */
export function reportingDayKeys(days: number, now: Date = new Date()): string[] {
  const todayStart = startOfReportingDay(reportingDateKey(now));
  const keys: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    keys.push(reportingDateKey(new Date(todayStart.getTime() - i * DAY_MS)));
  }

  return keys;
}

/**
 * `date_trunc('day', ts AT TIME ZONE 'Asia/Kolkata')` returns a timestamp
 * whose calendar date is already the reporting date, so reading it back as
 * UTC yields the matching key.
 */
export function rowDateKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** Short weekday label for a day key, e.g. "Mon". */
export function dayLabel(dateKey: string): string {
  // Midday avoids any chance of the label sliding to a neighbouring day.
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short' });
}

/**
 * The half-open instant range `[start, end)` covering one reporting day.
 *
 * Delivery rounds are planned per IST day, so a query written against UTC
 * midnight would put an order placed at 11pm on the next morning's route
 * sheet. Half-open rather than inclusive so an order timestamped exactly at
 * midnight belongs to one day only.
 */
export function istDayRange(dateKey?: string): { start: Date; end: Date; key: string } {
  const key = dateKey || reportingDateKey(new Date());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Expected a YYYY-MM-DD date, received "${key}"`);
  }

  const start = startOfReportingDay(key);
  const end = new Date(start.getTime() + DAY_MS);

  return { start, end, key };
}
