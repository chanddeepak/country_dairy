// Storefront Privacy-Friendly Custom Analytics Tracker

export interface TrackEventPayload {
  eventName: string;
  productId?: string;
  productName?: string;
  variantLabel?: string;
  price?: number;
  deviceType?: 'desktop' | 'mobile';
}

export function trackStorefrontEvent(payload: TrackEventPayload) {
  try {
    const timestamp = new Date().toISOString();
    const eventData = {
      ...payload,
      timestamp,
      referrer: typeof window !== 'undefined' ? document.referrer : '',
      deviceType: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
    };

    console.log('[Analytics Event Captured]:', eventData);

    // Send payload to Vercel Analytics or backend logging endpoint
    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va('event', { name: payload.eventName, data: eventData });
    }
  } catch (e) {
    console.error('Analytics tracking error:', e);
  }
}
