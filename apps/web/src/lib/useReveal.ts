'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reveals an element the first time it scrolls into view.
 *
 * The brief asks for a scroll reveal on most of the homepage's editorial
 * sections, so this is the single place that decides how the reveal behaves.
 * It fires once and disconnects: a section that fades out again on the way back
 * up draws attention to the mechanism instead of the content.
 *
 * Reduced motion needs no branch here. globals.css collapses every transition
 * to nothing, so the section simply arrives already in place.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(rootMargin = '-12% 0px') {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer means no reveal, not a section nobody can read.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin, threshold: 0.05 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, shown };
}
