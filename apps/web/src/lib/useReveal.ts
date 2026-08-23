'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Reveals an element the first time it scrolls into view.
 *
 * The brief asks for a scroll reveal on most of the homepage's editorial
 * sections, so this is the single place that decides how the reveal behaves.
 * It fires once and disconnects — a section that fades out again on the way
 * back up advertises the mechanism instead of the content.
 *
 * A callback ref rather than useRef with an effect, because most of these
 * sections render nothing until their fetch lands. An effect running on mount
 * finds ref.current still null, returns, and never runs again: the section
 * arrives later and stays invisible forever. A callback ref attaches whenever
 * the node actually appears.
 *
 * Reduced motion needs no branch here. globals.css already collapses every
 * transition, so the section simply arrives in place.
 */
export function useReveal(rootMargin = '-12% 0px') {
  const [shown, setShown] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node) return;

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

      io.observe(node);
      observer.current = io;
    },
    [rootMargin],
  );

  return { ref, shown };
}
