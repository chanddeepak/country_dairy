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
    // Its own file, not the one BrandStatement uses. That image is composed
    // 3:2 for a landscape box; this panel is a 3:4 portrait, and sharing one
    // file meant whichever section was second got a hard crop of a photograph
    // framed for the other.
    image: '/images/journey-land.jpg',
    body: 'The Kumaon foothills above Tanakpur — terraced slopes, forest, and pasture that stays green long past the monsoon.',
  },
  {
    label: 'The Source',
    alt: 'Cattle grazing a hill pasture below snow peaks',
    image: '/images/journey-source.jpg',
    body: 'Native desi cows graze those slopes and drink mountain spring water. The milk is collected in the morning.',
  },
  {
    label: 'The Craft',
    alt: 'Warm ghee poured from a spoon beside brass vessels and lit lamps',
    image: '/images/journey-craft-v2.jpg',
    body: 'Milk is set to curd, churned to butter, and simmered slowly in small batches until it runs clear and golden.',
  },
  {
    label: 'The Product',
    alt: 'A spoonful of set ghee lifted from an open jar',
    image: '/images/journey-product-v2.jpg',
    body: 'Poured warm into glass, sealed, and recorded against its batch before it leaves the farm.',
  },
  {
    label: 'Your Home',
    alt: 'A jar of ghee beside rice, dal and a wooden spoon',
    image: '/images/journey-home-v2.jpg',
    body: 'On hot rotis, in dal, over rice. The everyday cooking it was always meant for.',
  },
];

function Panel({
  step,
  index,
  fill = false,
}: {
  step: (typeof STEPS)[number];
  index: number;
  /**
   * True inside the pinned strip, where the panel is handed whatever height is
   * left after the heading. The stacked version has no height given to it and
   * needs the minimum to stand up on its own.
   */
  fill?: boolean;
}) {
  return (
    <div
      className={`relative flex w-full overflow-hidden bg-[var(--forest)] ${
        fill ? 'h-full' : 'h-full min-h-[540px]'
      }`}
    >
      <ContourField tone="brass" spacing={52} opacity={0.14} className="absolute inset-0" />

      <div
        className={`relative mx-auto flex h-full w-full max-w-7xl flex-col justify-center gap-9 px-6 sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:px-20 ${
          fill ? 'py-8' : 'py-14'
        }`}
      >
        <div className="lg:flex-1">
          <p className="tabular font-serif text-[13px] tracking-[0.2em] text-[var(--brass-on-dark)]">
            {String(index + 1).padStart(2, '0')}
          </p>
          <h3 className="mt-4 font-serif text-[clamp(32px,5vw,64px)] font-light leading-[1.02] tracking-[-0.02em] text-[var(--ivory)]">
            {step.label}
          </h3>
          <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.8] text-[var(--sand)]">
            {step.body}
          </p>
        </div>

        {/*
          Height-led inside the pinned strip, width-led in the stacked list.
          
          A fixed 360x480 card fitted a tall window and was cut off by the
          bottom of a short one — the photograph does not know how much screen
          is left after the heading and the chapter text have taken theirs.
          Driving it from the available height instead means it shrinks rather
          than clips, and the 3:4 ratio keeps the crop honest.
        */}
        <div
          className={`relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-[var(--pine)] sm:max-w-[320px] ${
            fill
              ? 'lg:h-full lg:max-h-[460px] lg:w-auto lg:max-w-none'
              : 'lg:w-[360px] lg:max-w-none'
          }`}
        >
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
  /*
   * The site header is `sticky top-0` too, so a strip pinned at 0 puts its
   * heading underneath it — the heading was there and invisible. This is its
   * height, so the strip can start below it and take the rest of the screen.
   */
  const [headerH, setHeaderH] = useState(0);

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

    const measureHeader = () => {
      const header = document.querySelector('header');
      setHeaderH(header ? Math.round(header.getBoundingClientRect().height) : 0);
    };
    measureHeader();
    window.addEventListener('resize', measureHeader);

    let frame = 0;

    const update = () => {
      frame = 0;
      const outer = outerRef.current;
      const row = rowRef.current;
      if (!outer || !row) return;

      // The pinned box is a screen minus the header, so that is the distance
      // the outer container can scroll before the strip is done.
      const travel = outer.offsetHeight - (window.innerHeight - headerH);
      const scrolled = -outer.getBoundingClientRect().top;
      const progress = travel > 0 ? Math.min(1, Math.max(0, scrolled / travel)) : 0;

      /*
       * Each chapter holds still, then slides to the next one.
       *
       * Mapping scroll straight onto travel moved the strip continuously, so a
       * panel was only ever whole at the exact boundaries and every position
       * in between showed two half-panels with their photographs cut by the
       * screen edges. Now a quarter of each segment is spent arriving, half
       * holding, and a quarter leaving — so a chapter is complete and still
       * for most of the time it is on screen.
       */
      const gaps = STEPS.length - 1;
      const segment = 1 / gaps;
      const index = Math.min(gaps - 1, Math.floor(progress / segment));
      const local = (progress - index * segment) / segment;

      const HOLD = 0.25;
      const moving = Math.min(1, Math.max(0, (local - HOLD) / (1 - HOLD * 2)));
      const eased = moving * moving * (3 - 2 * moving);

      row.style.transform = `translate3d(${-(index + eased) * 100}vw, 0, 0)`;
      setActive(Math.min(STEPS.length - 1, Math.round(index + eased)));
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
      window.removeEventListener('resize', measureHeader);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pinned, headerH]);

  const intro = (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-on-dark)]">
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
      <div ref={outerRef} className="relative h-[400vh]">
        {/*
          The heading belongs inside the pinned screen, not above it.
          
          It used to sit outside, so the moment this section arrived the
          viewport held the heading, then roughly 450px of empty green, then a
          panel whose content was centred in a full screen height it did not
          share — the first chapter started below the fold. Pinning them
          together means the heading stays put while the chapters move under
          it, which is what the interaction was describing anyway.
        */}
        <div
          className="sticky flex flex-col overflow-hidden"
          style={{ top: headerH, height: `calc(100vh - ${headerH}px)` }}
        >
          <div className="shrink-0 pt-10">{intro}</div>

          <div
            ref={rowRef}
            className="flex w-[500vw] flex-1 will-change-transform"
            style={{ transform: 'translate3d(0,0,0)' }}
          >
            {STEPS.map((step, i) => (
              <div key={step.label} className="h-full w-screen">
                <Panel step={step} index={i} fill />
              </div>
            ))}
          </div>

          <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2.5">
            {STEPS.map((step, i) => (
              <span
                key={step.label}
                className={`h-px w-10 transition-colors duration-300 ${
                  i <= active ? 'bg-[var(--brass)]' : 'bg-[rgb(var(--ivory-rgb)/0.25)]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
