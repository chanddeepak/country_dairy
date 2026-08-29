import { reconcileTotals } from './pricing';

/**
 * Re-deriving totals from what the gateway charged.
 *
 * This is the piece that is wrong quietly. Everything else in the checkout
 * fails loudly — a bad address is visible, a failed payment is visible — but a
 * misapportioned discount produces an invoice that merely has the wrong tax on
 * it, and nobody notices until an auditor does.
 */
describe('reconcileTotals', () => {
  const lines = [
    { lineTotal: 1450, gstRate: 12 }, // ghee
    { lineTotal: 780, gstRate: 12 },
  ];

  it('changes nothing when the gateway charged what we asked', () => {
    const t = reconcileTotals(lines, 2230);
    expect(t.totalAmount).toBe(2230);
    expect(t.discountAmount).toBe(0);
    // 2230 inclusive of 12% => 2230 - 2230/1.12 = 238.93
    expect(t.taxAmount).toBe(238.93);
  });

  it('shares a gateway discount across lines by value', () => {
    // ₹223 off, i.e. exactly 10%.
    const t = reconcileTotals(lines, 2007);
    expect(t.totalAmount).toBe(2007);
    expect(t.discountAmount).toBe(223);
    // Tax must fall with the price, not stay at the pre-discount figure.
    expect(t.taxAmount).toBe(215.04);
    expect(t.taxAmount).toBeLessThan(238.93);
  });

  it('taxes mixed rates separately rather than averaging them', () => {
    const mixed = [
      { lineTotal: 1000, gstRate: 12 }, // ghee
      { lineTotal: 1000, gstRate: 5 }, // a 5% good
    ];
    const full = reconcileTotals(mixed, 2000);
    // 1000/1.12 => 107.14 of tax; 1000/1.05 => 47.62. Averaging the rates at
    // 8.5% would give 156.68, which is a different number and a wrong invoice.
    expect(full.taxAmount).toBe(154.76);

    const discounted = reconcileTotals(mixed, 1800);
    expect(discounted.discountAmount).toBe(200);
    expect(discounted.taxAmount).toBe(139.29);
  });

  it('does not treat a gateway fee as a discount', () => {
    // They charged 2280: our 2230 of goods plus ₹50 of their shipping.
    const t = reconcileTotals(lines, 2280, 50);
    expect(t.discountAmount).toBe(0);
    expect(t.deliveryCharges).toBe(50);
    expect(t.totalAmount).toBe(2280);
    // Their shipping is not our supply, so it carries none of our GST.
    expect(t.taxAmount).toBe(238.93);
  });

  it('handles a discount and a fee at once', () => {
    const t = reconcileTotals(lines, 2057, 50); // 2007 of goods + 50 shipping
    expect(t.discountAmount).toBe(223);
    expect(t.deliveryCharges).toBe(50);
    expect(t.totalAmount).toBe(2057);
    expect(t.taxAmount).toBe(215.04);
  });

  it('never reports a negative discount when they charged more', () => {
    const t = reconcileTotals(lines, 2400);
    expect(t.discountAmount).toBe(0);
    expect(t.totalAmount).toBe(2400);
  });

  it('survives an empty order without dividing by zero', () => {
    const t = reconcileTotals([], 0);
    expect(t.taxAmount).toBe(0);
    expect(t.totalAmount).toBe(0);
  });
});
