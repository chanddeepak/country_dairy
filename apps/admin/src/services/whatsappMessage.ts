import type { AdminOrder } from '../types';

/**
 * Opens WhatsApp with a message to the customer already written.
 *
 * Deliberately not the Cloud API. A dispatch notice is staff-initiated and
 * low-volume, so a pre-filled `wa.me` link costs nothing, needs no Meta
 * onboarding, no template approval and no per-message fee — and it goes out
 * from the business number the customer already recognises rather than a new
 * one they have never seen.
 *
 * The trade is that a person presses send. That is right here and would be
 * wrong for a sign-in code, which has to arrive in seconds with nobody
 * watching. That one still needs the API.
 */

/** WhatsApp wants digits with a country code and no punctuation. */
function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // A bare ten-digit Indian mobile needs the country code; anything longer
  // already carries one.
  return digits.length === 10 ? `91${digits}` : digits;
}

export function customerPhone(order: AdminOrder): string | null {
  /*
   * The address phone first. It is the number Cashfree verified, and when the
   * order is a gift it belongs to the person actually expecting the parcel —
   * which is who a dispatch notice is for.
   */
  const raw = order.shippingAddress?.phone || order.user?.phone;
  if (!raw) return null;
  const number = toWhatsAppNumber(raw);
  return /^\d{11,15}$/.test(number) ? number : null;
}

function greeting(order: AdminOrder): string {
  const name = order.shippingAddress?.name || order.user?.name;
  return name ? `Hi ${name},` : 'Hello,';
}

export function confirmedMessage(order: AdminOrder): string {
  return [
    greeting(order),
    '',
    `We have your order ${order.orderNumber} and it is being packed.`,
    `Total: ₹${Number(order.totalAmount).toLocaleString('en-IN')}`,
    '',
    'We will send tracking as soon as it ships.',
  ].join('\n');
}

export function dispatchMessage(order: AdminOrder): string {
  const lines = [
    greeting(order),
    '',
    `Your Country Dairy order ${order.orderNumber} has been dispatched.`,
  ];

  if (order.trackingNumber) {
    lines.push(
      order.shippingCarrier
        ? `${order.shippingCarrier} tracking: ${order.trackingNumber}`
        : `Tracking: ${order.trackingNumber}`,
    );
  }

  lines.push('', 'Thank you for buying from the hills.');
  return lines.join('\n');
}

export function deliveredMessage(order: AdminOrder): string {
  return [
    greeting(order),
    '',
    `Order ${order.orderNumber} has been delivered.`,
    '',
    'We would love to know how you find it.',
  ].join('\n');
}

/** The message that fits where this order currently is. */
export function messageForStatus(order: AdminOrder): { label: string; body: string } {
  switch (order.status) {
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      return { label: 'Send tracking', body: dispatchMessage(order) };
    case 'DELIVERED':
      return { label: 'Ask how it was', body: deliveredMessage(order) };
    default:
      return { label: 'Confirm on WhatsApp', body: confirmedMessage(order) };
  }
}

/** Opens WhatsApp in a new tab with the message ready for a human to send. */
export function openWhatsApp(order: AdminOrder, message: string): void {
  const number = customerPhone(order);
  if (!number) return;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}
