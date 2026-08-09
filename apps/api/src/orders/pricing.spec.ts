import {
  calculateDeliveryCharge,
  calculateDiscount,
  calculateOrderTotals,
  priceLine,
  round2,
  toPaise,
} from './pricing';

describe('priceLine', () => {
  it('multiplies unit price by quantity', () => {
    const line = priceLine(3, 780, 12);
    expect(line.lineTotal).toBe(2340);
  });

  // The bug this suite exists for: checkout previously fell back to a flat
  // ₹100 per line because the variant was never loaded.
  it('never substitutes a default price', () => {
    expect(priceLine(1, 1450, 12).lineTotal).toBe(1450);
    expect(priceLine(2, 48, 0).lineTotal).toBe(96);
  });

  it('extracts GST from a tax-inclusive price', () => {
    // ₹112 at 12% is ₹100 of goods and ₹12 of tax.
    const line = priceLine(1, 112, 12);
    expect(line.taxAmount).toBe(12);
  });

  it('charges no tax on a zero-rated product such as milk', () => {
    const line = priceLine(4, 95, 0);
    expect(line.taxAmount).toBe(0);
    expect(line.lineTotal).toBe(380);
  });

  it('rounds to paise rather than accumulating float drift', () => {
    const line = priceLine(3, 33.33, 5);
    expect(line.lineTotal).toBe(99.99);
  });
});

describe('calculateDeliveryCharge', () => {
  it('is free at or above the threshold', () => {
    expect(calculateDeliveryCharge(500)).toBe(0);
    expect(calculateDeliveryCharge(1450)).toBe(0);
  });

  it('applies the flat charge below the threshold', () => {
    expect(calculateDeliveryCharge(499.99)).toBe(40);
    expect(calculateDeliveryCharge(96)).toBe(40);
  });
});

describe('calculateDiscount', () => {
  it('applies a percentage discount', () => {
    expect(calculateDiscount(1000, { discountType: 'PERCENTAGE', discountValue: 10 })).toBe(100);
  });

  it('respects the maximum discount cap', () => {
    const discount = calculateDiscount(10000, {
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscountAmount: 500,
    });
    expect(discount).toBe(500);
  });

  it('does not apply below the minimum order value', () => {
    const discount = calculateDiscount(200, {
      discountType: 'FIXED_AMOUNT',
      discountValue: 100,
      minOrderAmount: 500,
    });
    expect(discount).toBe(0);
  });

  it('never discounts more than the order is worth', () => {
    const discount = calculateDiscount(150, {
      discountType: 'FIXED_AMOUNT',
      discountValue: 500,
    });
    expect(discount).toBe(150);
  });

  it('returns zero when no coupon is applied', () => {
    expect(calculateDiscount(1000, null)).toBe(0);
  });
});

describe('calculateOrderTotals', () => {
  it('totals a mixed-GST basket the way an invoice must', () => {
    // 1 x ghee at ₹1450 (12% GST) + 2 x milk at ₹95 (0% GST)
    const lines = [priceLine(1, 1450, 12), priceLine(2, 95, 0)];
    const totals = calculateOrderTotals(lines);

    expect(totals.subtotal).toBe(1640);
    expect(totals.taxAmount).toBe(155.36);
    expect(totals.deliveryCharges).toBe(0);
    expect(totals.totalAmount).toBe(1640);
  });

  it('adds delivery to a small order', () => {
    const totals = calculateOrderTotals([priceLine(1, 48, 0)]);

    expect(totals.subtotal).toBe(48);
    expect(totals.deliveryCharges).toBe(40);
    expect(totals.totalAmount).toBe(88);
  });

  it('applies a discount before deciding on free delivery', () => {
    // ₹520 less a ₹100 coupon is ₹420, which falls back under the threshold.
    const totals = calculateOrderTotals([priceLine(1, 520, 0)], {
      discountType: 'FIXED_AMOUNT',
      discountValue: 100,
    });

    expect(totals.discountAmount).toBe(100);
    expect(totals.deliveryCharges).toBe(40);
    expect(totals.totalAmount).toBe(460);
  });

  it('is never negative even with an oversized coupon', () => {
    const totals = calculateOrderTotals([priceLine(1, 100, 0)], {
      discountType: 'FIXED_AMOUNT',
      discountValue: 999,
    });

    expect(totals.totalAmount).toBeGreaterThanOrEqual(0);
  });
});

describe('toPaise', () => {
  it('converts rupees to the minor unit Razorpay expects', () => {
    expect(toPaise(1450)).toBe(145000);
    expect(toPaise(88.5)).toBe(8850);
  });

  it('does not lose a paisa to float representation', () => {
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
});

describe('round2', () => {
  it('rounds half up at the paisa', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.344)).toBe(2.34);
  });
});
