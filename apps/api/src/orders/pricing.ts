/**
 * Order pricing. Kept as pure functions so the money maths can be unit-tested
 * without a database or a payment gateway.
 *
 * All amounts are rupees rounded to 2 decimal places. GST in India is
 * inclusive of the listed price, so tax is extracted from the line total
 * rather than added on top of it.
 */

export const FREE_DELIVERY_THRESHOLD = 500;
export const STANDARD_DELIVERY_CHARGE = 40;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface PricedLine {
  quantity: number;
  unitPrice: number;
  gstRate: number;
  lineTotal: number;
  taxAmount: number;
}

/**
 * Extracts the GST component already contained in a line total.
 * A ₹112 line at 12% GST is ₹100 of goods plus ₹12 of tax.
 */
export function priceLine(quantity: number, unitPrice: number, gstRate: number): PricedLine {
  const lineTotal = round2(unitPrice * quantity);
  const taxAmount = gstRate > 0 ? round2(lineTotal - lineTotal / (1 + gstRate / 100)) : 0;

  return { quantity, unitPrice, gstRate, lineTotal, taxAmount };
}

export function calculateDeliveryCharge(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_CHARGE;
}

export interface DiscountInput {
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
}

export function calculateDiscount(subtotal: number, coupon: DiscountInput | null): number {
  if (!coupon) return 0;
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) return 0;

  const raw =
    coupon.discountType === 'PERCENTAGE'
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;

  const capped = coupon.maxDiscountAmount ? Math.min(raw, coupon.maxDiscountAmount) : raw;

  // Never discount below zero, and never more than the order is worth.
  return round2(Math.max(0, Math.min(capped, subtotal)));
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  deliveryCharges: number;
  totalAmount: number;
}

export function calculateOrderTotals(
  lines: PricedLine[],
  coupon: DiscountInput | null = null,
): OrderTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const taxAmount = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
  const discountAmount = calculateDiscount(subtotal, coupon);
  const deliveryCharges = calculateDeliveryCharge(subtotal - discountAmount);
  const totalAmount = round2(subtotal - discountAmount + deliveryCharges);

  return { subtotal, taxAmount, discountAmount, deliveryCharges, totalAmount };
}

/** Rupees to paise — Razorpay works in the minor unit. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
