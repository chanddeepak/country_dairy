import { businessFinancialYear, businessYear } from './number-series.service';

/**
 * The clock these numbers are dated by.
 *
 * Render runs UTC and the shop runs in India, so for the first five and a half
 * hours of every Indian day the two disagree about the date. For an order
 * number that is untidy; for an invoice crossing 1 April it files a supply in
 * the wrong financial year, which is a GST problem.
 */
describe('businessYear', () => {
  it('uses the Indian date, not the host clock', () => {
    // 01:30 IST on 1 January 2027 — still 31 December in UTC.
    expect(businessYear(new Date('2026-12-31T20:00:00Z'))).toBe(2027);
  });

  it('agrees with UTC once the two are on the same day', () => {
    expect(businessYear(new Date('2027-01-01T09:00:00Z'))).toBe(2027);
  });
});

describe('businessFinancialYear', () => {
  it('runs April to March', () => {
    expect(businessFinancialYear(new Date('2026-04-01T06:00:00Z'))).toBe('2026-27');
    expect(businessFinancialYear(new Date('2027-03-31T06:00:00Z'))).toBe('2026-27');
    expect(businessFinancialYear(new Date('2027-04-01T06:00:00Z'))).toBe('2027-28');
  });

  it('turns over at midnight in India, not in UTC', () => {
    // 02:00 IST on 1 April 2027 is 20:30 UTC on 31 March — a new financial
    // year in the shop, the old one on the server. An invoice numbered here
    // under the old FY would be filed against the wrong return.
    expect(businessFinancialYear(new Date('2027-03-31T20:30:00Z'))).toBe('2027-28');
  });
});
