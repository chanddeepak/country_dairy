'use client';

import React from 'react';
import Image from 'next/image';
import ContourField from '../ui/ContourField';
import { useReveal } from '../../lib/useReveal';

/**
 * Where the brand is from, which the brief asks for without letting it become a
 * tourism advertisement.
 *
 * The difference between the two is what the section talks about. A tourism page
 * describes the place; this one describes what the place does to the milk —
 * grass, spring water, cold air — and stops there. Nothing here claims a health
 * benefit, and the one line about walking to pasture is a claim the story
 * section has always made.
 *
 * This is also the section that most earns the contour signature: a topographic
 * pattern is the map of a hillside, and here it is behind an actual hillside.
 */
const ACCENTS = ['Terraced fields', 'Spring water', 'Hill flora', 'Pahadi kitchens', 'Mountain roads'];

export default function Devbhoomi() {
  const { ref, shown } = useReveal();
  const rise = shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0';

  return (
    <section
      id="about"
      ref={ref}
      className="relative scroll-mt-24 overflow-hidden bg-[var(--cream)] py-20 sm:py-28"
    >
      <ContourField tone="forest" spacing={54} opacity={0.1} className="absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className={`lg:col-span-5 transition-all duration-[900ms] ease-out ${rise}`}>
            {/*
              2:3, not 463/820.
              
              The old ratio was 0.565 — not a design decision, just the exact
              dimensions of whichever file was here first, which meant any
              replacement had to be cropped to fit a number nothing chose. 2:3
              is a ratio a camera and a generator both produce, so the picture
              arrives whole.
            */}
            <div className="relative mx-auto aspect-[2/3] w-full max-w-[300px] overflow-hidden bg-[var(--sand)] sm:max-w-[350px] lg:max-w-[380px]">
              <Image
                src="/images/devbhoomi-pasture-v2.jpg"
                alt="A jar of Country Dairy ghee on a rock, a cow grazing the pasture beyond, snow peaks along the horizon"
                fill
                sizes="(min-width: 1024px) 36vw, 80vw"
                className="object-cover"
              />
            </div>
          </div>

          <div
            className={`lg:col-span-7 transition-all delay-150 duration-[900ms] ease-out ${rise}`}
          >
            <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-text)]">
              Uttarakhand
            </p>

            <h2 className="text-balance font-serif text-[clamp(30px,4.4vw,52px)] font-light leading-[1.08] tracking-[-0.015em] text-[var(--ink)]">
              Rooted in Devbhoomi.
            </h2>

            <div className="mt-7 space-y-4 text-[15px] leading-[1.8] text-[var(--ink-soft)]">
              <p className="max-w-[58ch]">
                Uttarakhand is called Devbhoomi, the land of the gods. Our farm sits at
                Tanakpur in Champawat, where the plains end and the Kumaon hills begin —
                terraced fields cut into the slopes, forest above the villages, and cattle
                that walk out to pasture rather than stand in a shed.
              </p>
              <p className="max-w-[58ch]">
                What the hills give the milk is grass, spring water and cold air. That is
                the whole of it, and it is the reason the dairy is here rather than
                somewhere easier to reach.
              </p>
            </div>

            <ul className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--line)] pt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              {ACCENTS.map((accent, i) => (
                <li key={accent} className="flex items-center gap-3">
                  {i > 0 ? <span className="text-[var(--brass-text)]">·</span> : null}
                  {accent}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
