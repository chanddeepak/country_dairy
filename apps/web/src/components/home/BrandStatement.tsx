'use client';

import React from 'react';
import Image from 'next/image';
import { useReveal } from '../../lib/useReveal';

/**
 * The claim, made once, that the rest of the page then evidences.
 *
 * It sits directly under the hero because a visitor who has just read "A taste
 * of the Himalayas" needs to know within one scroll whether that is scenery or
 * the actual reason to buy. The sections below — the collection, the making,
 * Devbhoomi — are the proof; this is the assertion.
 *
 * The photograph is a landscape rather than the portrait an editorial spread
 * would normally take, because the only lettering-free source we have is a wide
 * frame and upscaling a crop of it would look worse than the honest shape.
 */
export default function BrandStatement() {
  const { ref, shown } = useReveal();

  const rise = shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0';

  return (
    <section ref={ref} className="bg-[var(--ivory)] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div
            className={`lg:col-span-5 transition-all duration-[900ms] ease-out ${rise}`}
          >
            <h2 className="text-balance font-serif text-[clamp(30px,4.6vw,54px)] font-light leading-[1.1] tracking-[-0.015em] text-[var(--ink)]">
              Some flavours are more than flavours.
              <span className="mt-1 block text-balance italic text-[var(--brass)]">
                They carry a place with them.
              </span>
            </h2>

            <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.75] text-[var(--ink-soft)]">
              Country Dairy is rooted in the natural beauty and traditions of Uttarakhand,
              bringing carefully selected and thoughtfully made products from the mountains
              to modern homes.
            </p>
          </div>

          <div
            className={`lg:col-span-7 transition-all delay-150 duration-[900ms] ease-out ${rise}`}
          >
            <div className="relative aspect-[3/2] overflow-hidden bg-[var(--sand)]">
              <Image
                src="/images/statement-hills.jpg"
                alt="Terraced hillside fields under early morning light"
                fill
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
