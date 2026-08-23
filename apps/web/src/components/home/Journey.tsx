'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ContourField from '../ui/ContourField';

/**
 * From the mountains to your home, as the brief's signature interaction: five
 * chapters that move sideways while the page scrolls down.
 *
 * The pin runs on a wide pointer-driven screen and nowhere else. Below the large
 * breakpoint, and whenever reduced motion is asked for, the same five chapters
 * are simply a vertical list — the content is identical, only the reading
 * direction changes. Pinning four screens of horizontal travel on a phone is how
 * a signature interaction becomes a trap.
 *
 * The transform is written straight to the node rather than held in state. This
 * updates on every scroll frame, and a setState per frame re-renders five
 * panels and their images for nothing.
 *
 * The photographs are the brand's own, out of the product gallery, and they are
 * small. So they are shown at a size the files can actually carry rather than
 * blown across a whole panel. Two of them were cropped further to cut off a
 * strip where the jar's back label was legible.
 */
const STEPS = [
  {
    label: 'The Land',
    alt: 'Terraced hillside fields under early morning light',
    image: '/images/statement-hills.jpg',
    body: 'The Kumaon foothills above Tanakpur — terraced slopes, forest, and pasture that stays green long past the monsoon.',
  },
  {
    label: 'The Source',
    alt: 'Cattle grazing a hill pasture below snow peaks',
    image: '/images/devbhoomi-pasture.jpg',
    body: 'Native desi cows graze those slopes and drink mountain spring water. The milk is collected in the morning.',
  },
  {
    label: 'The Craft',
    alt: 'Warm ghee poured from a spoon beside brass vessels and lit lamps',
    image: '/images/journey-craft.jpg',
    body: 'Milk is set to curd, churned to butter, and simmered slowly in small batches until it runs clear and golden.',
  },
  {
    label: 'The Product',
    alt: 'A spoonful of set ghee lifted from an open jar',
    image: '/images/journey-product.jpg',
    body: 'Poured warm into glass, sealed, and recorded against its batch before it leaves the farm.',
  },
  {
    label: 'Your Home',
    alt: 'A jar of ghee beside rice, dal and a wooden spoon',
    image: '/images/journey-home.jpg',
    body: 'On hot rotis, in dal, over rice. The everyday cooking it was always meant for.',
  },
];

function Panel({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  return (
    <div className="relative flex h-full min-h-[540px] w-full overflow-hidden bg-[var(--forest)]">
      <ContourField tone="brass" spacing={52} opacity={0.14} className="absolute inset-0" />

      <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col justify-center gap-9 px-6 py-14 sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:px-20">
        <div className="lg:flex-1">
          <p className="tabular font-serif text-[13px] tracking-[0.2em] text-[var(--brass)]">
            {String(index + 1).padStart(2, '0')}
          </p>
          <h3 className="mt-4 font-serif text-[clamp(32px,5vw,64px)] font-light leading-[1.02] tracking-[-0.02em] text-[var(--ivory)]">
            {step.label}
          </h3>
          <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.8] text-[var(--sand)]">
            {step.body}
          </p>
        </div>

        {/* Sized to what the source can carry. These came out of the product
            gallery at thumbnail scale, so a full-bleed panel would be a smear;
            a card at 360px is close to their native width. */}
        <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[var(--pine)] sm:max-w-[320px] lg:w-[360px] lg:max-w-none">
          <Image
            src={step.image}
            alt={step.alt}
            fill
            sizes="(min-width: 1024px) 360px, 92vw"
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export default function Journey() {
  const outerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setPinned(wide.matches && !still.matches);
    decide();
    wide.addEventListener('change', decide);
    still.addEventListener('change', decide);
    return () => {
      wide.removeEventListener('change', decide);
      still.removeEventListener('change', decide);
    };
  }, []);

  useEffect(() => {
    if (!pinned) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const outer = outerRef.current;
      const row = rowRef.current;
      if (!outer || !row) return;

      const travel = outer.offsetHeight - window.innerHeight;
      const scrolled = -outer.getBoundingClientRect().top;
      const progress = travel > 0 ? Math.min(1, Math.max(0, scrolled / travel)) : 0;

      row.style.transform = `translate3d(${-progress * (STEPS.length - 1) * 100}vw, 0, 0)`;
      setActive(Math.min(STEPS.length - 1, Math.round(progress * (STEPS.length - 1))));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pinned]);

  const intro = (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
        The journey
      </p>
      <h2 className="text-balance font-serif text-[clamp(28px,4vw,46px)] font-light leading-[1.08] tracking-[-0.012em] text-[var(--ivory)]">
        From the mountains to your home.
      </h2>
    </div>
  );

  if (!pinned) {
    return (
      <section className="bg-[var(--forest)] py-16 sm:py-20">
        {intro}
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8">
          {STEPS.map((step, i) => (
            <div key={step.label}>
              <Panel step={step} index={i} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[var(--forest)]">
      <div className="pt-20">{intro}</div>

      <div ref={outerRef} className="relative h-[400vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div
            ref={rowRef}
            className="flex h-full w-[500vw] will-change-transform"
            style={{ transform: 'translate3d(0,0,0)' }}
          >
            {STEPS.map((step, i) => (
              <div key={step.label} className="h-full w-screen">
                <Panel step={step} index={i} />
              </div>
            ))}
          </div>

          <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2.5">
            {STEPS.map((step, i) => (
              <span
                key={step.label}
                className={`h-px w-10 transition-colors duration-300 ${
                  i <= active ? 'bg-[var(--brass)]' : 'bg-[var(--ivory)]/25'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
