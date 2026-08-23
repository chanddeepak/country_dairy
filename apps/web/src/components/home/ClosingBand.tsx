'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ContourField from '../ui/ContourField';
import { useReveal } from '../../lib/useReveal';

/**
 * The last thing on the page, and the brief asks for it to be minimal and
 * emotional: one landscape, one line, one way in.
 *
 * Centred, which the rest of this design avoids — but a closing band is the one
 * place where the sentence is the whole composition and there is nothing for it
 * to be asymmetric against.
 *
 * The slow zoom is the brief's "rhythm of the mountains" read literally: two and
 * a half seconds for a five percent move, which is below the speed at which
 * motion reads as motion. Reduced motion removes it, as it removes everything
 * else, through globals.css.
 */
export default function ClosingBand() {
  const { ref, shown } = useReveal();

  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-[var(--forest)]">
      <Image
        src="/images/closing-valley.jpg"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className={`object-cover transition-transform duration-[2500ms] ease-out ${
          shown ? 'scale-100' : 'scale-105'
        }`}
      />
      <div className="absolute inset-0 bg-[var(--forest)]/72" />
      <ContourField tone="brass" spacing={58} opacity={0.14} className="absolute inset-0" />

      <div className="relative mx-auto flex min-h-[520px] max-w-3xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <h2
          className={`text-balance font-serif text-[clamp(32px,5vw,60px)] font-light leading-[1.06] tracking-[-0.018em] text-[var(--ivory)] transition-all duration-[900ms] ease-out ${
            shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          Bring the Himalayas home.
        </h2>

        <p
          className={`mt-6 max-w-[46ch] text-[15px] leading-[1.8] text-[var(--sand)] transition-all delay-150 duration-[900ms] ease-out ${
            shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
          }`}
        >
          Thoughtfully made foods from the heart of Uttarakhand.
        </p>

        <Link
          href="/products"
          className={`mt-10 inline-flex items-center rounded-sm bg-[var(--ivory)] px-8 py-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--forest)] transition-all duration-[900ms] ease-out hover:bg-[var(--brass)] hover:text-[#1a1405] ${
            shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
          }`}
          style={{ transitionDelay: shown ? '260ms' : undefined }}
        >
          Explore Country Dairy
        </Link>
      </div>
    </section>
  );
}
