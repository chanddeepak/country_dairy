'use client';

import { useEffect, useRef } from 'react';

/**
 * The Himalayan contour signature.
 *
 * Drawn on a canvas rather than authored as SVG path data, for one practical
 * reason: the lines have to span containers whose width is not known until the
 * page lays out. A fixed path either stretches out of proportion or tiles
 * visibly. Redrawing on resize costs a few milliseconds and always fits.
 *
 * It is a watermark, never a texture. Over photography it sits at a fraction of
 * its opacity and is masked so it fades in; the design carries it on solid
 * grounds and lets the picture speak everywhere else.
 */

export type ContourTone = 'brass' | 'ivory' | 'forest';

const STROKE: Record<ContourTone, string> = {
  brass: 'rgba(176, 141, 66, 0.34)',
  ivory: 'rgba(251, 248, 241, 0.24)',
  forest: 'rgba(30, 58, 43, 0.16)',
};

export interface ContourFieldProps {
  tone?: ContourTone;
  /** Vertical distance between lines, in CSS pixels. Wider reads calmer. */
  spacing?: number;
  /** Overall strength, on top of the tone. Photography wants roughly 0.3. */
  opacity?: number;
  className?: string;
}

export default function ContourField({
  tone = 'brass',
  spacing = 26,
  opacity = 1,
  className = '',
}: ContourFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // Capped at 2: past that the extra pixels are invisible and the paint
      // cost on a large display is not.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, rect.width, rect.height);
      g.strokeStyle = STROKE[tone];
      g.lineWidth = 1;

      // Three sine terms per line. One alone reads as a wave; three interfere
      // so the spacing opens and closes the way contour intervals do where a
      // slope steepens.
      const lines = Math.ceil(rect.height / spacing) + 3;
      for (let i = 0; i < lines; i++) {
        const base = i * spacing - spacing;
        const amp = 13 + (i % 5) * 5;
        const phase = i * 0.42;

        g.beginPath();
        for (let x = 0; x <= rect.width; x += 7) {
          const t = x / rect.width;
          const y =
            base +
            Math.sin(t * 5.2 + phase) * amp +
            Math.sin(t * 11.3 + phase * 1.7) * amp * 0.34 +
            Math.sin(t * 2.1 - phase * 0.6) * amp * 0.5;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    };

    paint();

    // ResizeObserver rather than a window listener: these sit inside containers
    // that change size without the window doing so, and a window listener
    // misses every one of those.
    const ro = new ResizeObserver(() => paint());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [tone, spacing]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ opacity }}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
