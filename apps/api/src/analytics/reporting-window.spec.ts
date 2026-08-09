import {
  dayLabel,
  reportingDateKey,
  reportingDayKeys,
  rowDateKey,
  startOfReportingDay,
} from './reporting-window';

describe('reportingDateKey', () => {
  it('uses the IST calendar date, not the UTC one', () => {
    // 20:00 UTC on 9 Aug is already 01:30 on 10 Aug in India.
    expect(reportingDateKey(new Date('2026-08-09T20:00:00Z'))).toBe('2026-08-10');
  });

  it('keeps an early-morning UTC instant on the same IST day', () => {
    expect(reportingDateKey(new Date('2026-08-09T04:00:00Z'))).toBe('2026-08-09');
  });

  it('treats 18:29 UTC and 18:31 UTC as different IST days', () => {
    expect(reportingDateKey(new Date('2026-08-09T18:29:00Z'))).toBe('2026-08-09');
    expect(reportingDateKey(new Date('2026-08-09T18:31:00Z'))).toBe('2026-08-10');
  });
});

describe('startOfReportingDay', () => {
  it('resolves to 18:30 UTC the previous day', () => {
    expect(startOfReportingDay('2026-08-10').toISOString()).toBe('2026-08-09T18:30:00.000Z');
  });
});

describe('reportingDayKeys', () => {
  it('returns the requested number of consecutive days, oldest first', () => {
    const keys = reportingDayKeys(7, new Date('2026-08-09T10:00:00Z'));

    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-08-03');
    expect(keys[6]).toBe('2026-08-09');
  });

  it('includes today when called late in the IST evening', () => {
    // 23:00 IST on 9 Aug is 17:30 UTC — still the 9th in India.
    const keys = reportingDayKeys(3, new Date('2026-08-09T17:30:00Z'));
    expect(keys[2]).toBe('2026-08-09');
  });

  it('rolls over once IST passes midnight', () => {
    const keys = reportingDayKeys(3, new Date('2026-08-09T19:00:00Z'));
    expect(keys[2]).toBe('2026-08-10');
  });

  it('crosses a month boundary correctly', () => {
    const keys = reportingDayKeys(3, new Date('2026-09-01T10:00:00Z'));
    expect(keys).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });
});

describe('rowDateKey', () => {
  // Postgres date_trunc(... AT TIME ZONE 'Asia/Kolkata') hands back a
  // timestamp already shifted into IST; the driver reads it as UTC.
  it('matches the key format produced for the day series', () => {
    expect(rowDateKey(new Date('2026-08-09T00:00:00.000Z'))).toBe('2026-08-09');
  });

  it('lines up with reportingDayKeys so buckets actually join', () => {
    const keys = reportingDayKeys(7, new Date('2026-08-09T10:00:00Z'));
    expect(keys).toContain(rowDateKey(new Date('2026-08-09T00:00:00.000Z')));
  });
});

describe('dayLabel', () => {
  it('names the weekday of the key, not a neighbouring day', () => {
    expect(dayLabel('2026-08-09')).toBe('Sun');
    expect(dayLabel('2026-08-10')).toBe('Mon');
  });
});
