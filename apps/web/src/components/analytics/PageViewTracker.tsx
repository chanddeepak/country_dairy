'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackStorefrontEvent } from '../../lib/analytics';

/**
 * Records a page view on first render and on every client-side route change.
 * Next's App Router does not remount on navigation, so a plain mount effect
 * would only ever fire once per session.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackStorefrontEvent({ eventName: 'page_view' });
  }, [pathname]);

  return null;
}
