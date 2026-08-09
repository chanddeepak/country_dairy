// Storefront event tracking. Events are posted to our own API and stored in
// AnalyticsEvent, which is what the admin Overview dashboard reads. This
// previously only console.logged, so no dashboard could ever report real
// numbers.
import { API_URL } from './constants';

export interface TrackEventPayload {
  eventName:
    | 'page_view'
    | 'product_view'
    | 'whatsapp_order_click'
    | 'add_to_cart'
    | 'begin_checkout'
    | 'purchase';
  productId?: string;
  variantId?: string;
  productName?: string;
  variantLabel?: string;
  price?: number;
}

const SESSION_KEY = 'cd_session_id';

/** Anonymous per-tab id so repeat views can be grouped without identifying anyone. */
function getSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function trackStorefrontEvent(payload: TrackEventPayload): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    eventName: payload.eventName,
    productId: payload.productId,
    variantId: payload.variantId,
    sessionId: getSessionId(),
    deviceType: getDeviceType(),
    referrer: document.referrer || undefined,
    path: window.location.pathname,
    metadata: {
      ...(payload.productName ? { productName: payload.productName } : {}),
      ...(payload.variantLabel ? { variantLabel: payload.variantLabel } : {}),
      ...(payload.price !== undefined ? { price: payload.price } : {}),
    },
  });

  const url = `${API_URL}/analytics/track`;

  try {
    // sendBeacon survives the page unloading, which matters for the WhatsApp
    // click — that navigates away immediately and a normal fetch gets cancelled.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }

    // keepalive gives the fallback the same survive-navigation behaviour.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics must never interrupt a shopper.
    });
  } catch {
    // Ignored by design.
  }
}
