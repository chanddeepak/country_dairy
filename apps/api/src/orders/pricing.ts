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

/** One line as it was priced when the order was created. */
export interface LineForReconcile {
  /** What this line contributed to the order total, tax included. */
  lineTotal: number;
  /** GST percentage for the product on this line. */
  gstRate: number;
}

export interface ReconciledTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryCharges: number;
  totalAmount: number;
}

/**
 * Re-derives an order's totals from what the gateway actually charged.
 *
 * Cashfree can apply an offer from their own dashboard after we have created
 * the order, and can add shipping or COD handling of its own. Their figure is
 * the one money moved on, so it is the one the invoice has to show — ours was
 * only ever a quote.
 *
 * The hard part is tax. Our prices are GST-inclusive and the rate differs per
 * product, so a discount taken off the order as a whole has to be shared out
 * across the lines before tax can be recomputed. Sharing it in proportion to
 * each line's value is what keeps the arithmetic honest: a line worth twice as
 * much absorbs twice as much of the discount, and its tax falls accordingly.
 *
 * @param lines      the order's lines, as originally priced
 * @param charged    what the gateway took, in rupees
 * @param extraFees  shipping or handling the gateway added on top
 */
export function reconcileTotals(
  lines: LineForReconcile[],
  charged: number,
  extraFees = 0,
): ReconciledTotals {
  const originalGoods = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));

  // Whatever the gateway charged, minus anything it added itself, is what the
  // goods came to. Fees are not discountable and carry no GST of ours.
  const goodsCharged = round2(charged - extraFees);
  const discountAmount = round2(Math.max(0, originalGoods - goodsCharged));

  /*
   * Each line keeps its share of the total, so the discount lands where the
   * value is. With nothing to share out this collapses to the original split,
   * which is why the no-offer case needs no separate branch.
   */
  const scale = originalGoods > 0 ? goodsCharged / originalGoods : 0;

  let taxAmount = 0;
  for (const line of lines) {
    const after = line.lineTotal * scale;
    // Inclusive GST: a ₹112 line at 12% holds ₹12 of tax, not ₹13.44.
    taxAmount += after - after / (1 + line.gstRate / 100);
  }

  return {
    subtotal: originalGoods,
    discountAmount,
    taxAmount: round2(taxAmount),
    deliveryCharges: round2(extraFees),
    // Never recomputed from the parts. The gateway's number is the invoice's.
    totalAmount: round2(charged),
  };
}
