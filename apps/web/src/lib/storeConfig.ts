// Storefront runtime configuration, read from the API rather than compiled in.
//
// The WhatsApp number used to be a constant in two places — apps/web had
// 919997801112 and apps/mobile had 918291939317, so one set of customers was
// messaging the wrong number. There is now one value, editable from the admin
// console without a redeploy.
import { API_URL } from './constants';

export interface WhatsAppConfig {
  isEnabled: boolean;
  phoneNumber: string;
  messageTemplate: string;
  cartMessageTemplate: string;
}

export interface CartLineForMessage {
  productName: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
}

export async function fetchWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  try {
    const res = await fetch(`${API_URL}/cms/whatsapp`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as WhatsAppConfig;
  } catch {
    return null;
  }
}

export async function fetchFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(`${API_URL}/cms/feature-flags/map`, { cache: 'no-store' });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, boolean>;
  } catch {
    return {};
  }
}

const inr = (value: number) => value.toLocaleString('en-IN');

/** Fills the single-product template. */
export function buildProductMessage(
  config: WhatsAppConfig,
  line: CartLineForMessage,
): string {
  return config.messageTemplate
    .replace(/{quantity}/g, String(line.quantity))
    .replace(/{product_name}/g, line.productName)
    .replace(/{variant}/g, line.variantLabel ?? '')
    .replace(/{price}/g, inr(line.unitPrice))
    .replace(/{total_amount}/g, inr(line.unitPrice * line.quantity));
}

/** Fills the cart template, expanding {items} to one line per cart entry. */
export function buildCartMessage(
  config: WhatsAppConfig,
  lines: CartLineForMessage[],
): string {
  const itemLines = lines
    .map(
      (l) =>
        `- ${l.quantity} x ${l.productName}${l.variantLabel ? ` (${l.variantLabel})` : ''} — ₹${inr(l.unitPrice)}`,
    )
    .join('\n');

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return config.cartMessageTemplate
    .replace(/{items}/g, itemLines)
    .replace(/{total_amount}/g, inr(total));
}

export function whatsAppUrl(config: WhatsAppConfig, message: string): string {
  const digits = config.phoneNumber.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
