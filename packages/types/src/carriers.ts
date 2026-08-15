/**
 * The carriers this business ships with, and where a customer tracks them.
 *
 * Lives here because both apps need it and they were disagreeing: the console
 * offered five carriers and built the right tracking URL for each, while the
 * customer's order page said "Track on Delhivery" whatever the parcel actually
 * went out with — and linked to `#`, so it went nowhere at all. A parcel sent
 * by DTDC told its recipient to track it on a competitor's website.
 */
export interface Carrier {
  /** Stored on the order as shippingCarrier. */
  name: string;
  /** Where the customer follows the parcel. */
  trackUrl: (awb: string) => string;
}

export const CARRIERS: Carrier[] = [
  {
    name: 'Delhivery',
    trackUrl: (awb) => `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,
  },
  {
    name: 'Blue Dart',
    trackUrl: (awb) => `https://www.bluedart.com/tracking?awb=${encodeURIComponent(awb)}`,
  },
  {
    name: 'DTDC',
    trackUrl: (awb) => `https://www.dtdc.in/tracking.asp?strCnno=${encodeURIComponent(awb)}`,
  },
  {
    name: 'India Post',
    trackUrl: (awb) =>
      'https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx' +
      `?logicalname=${encodeURIComponent(awb)}`,
  },
  {
    name: 'Ekart',
    trackUrl: (awb) => `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(awb)}`,
  },
];

/** Case-insensitive, because the stored value is whatever the desk chose. */
export function findCarrier(name?: string | null): Carrier | undefined {
  if (!name) return undefined;
  const wanted = name.trim().toLowerCase();
  return CARRIERS.find((c) => c.name.toLowerCase() === wanted);
}

/**
 * A tracking URL, or null when there is nothing honest to link to.
 *
 * Null rather than a guess: a link that goes to the wrong carrier's site is
 * worse than no link, because the customer concludes their parcel is lost.
 */
export function trackingUrlFor(carrier?: string | null, awb?: string | null): string | null {
  if (!awb) return null;
  const match = findCarrier(carrier);
  return match ? match.trackUrl(awb) : null;
}

/** "Track on DTDC", or a neutral label when the carrier is unknown. */
export function trackingLabelFor(carrier?: string | null): string {
  const match = findCarrier(carrier);
  return match ? `Track on ${match.name}` : 'Track this parcel';
}
