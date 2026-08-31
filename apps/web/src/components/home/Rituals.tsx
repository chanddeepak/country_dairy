'use client';

import React from 'react';
import Image from 'next/image';
import { useReveal } from '../../lib/useReveal';

/**
 * The brief's one instruction for this section is that the brand must not read
 * as special-occasion, so the captions describe when the jar gets opened rather
 * than what it does for you.
 *
 * The source poster has a fourth photograph captioned with steam therapy, nasya
 * and sleep support. It is left out. Those are health claims, the brief rules
 * them out in the same breath, and a food page is not the place to make them.
 */
const RITUALS = [
  {
    image: '/images/ritual-morning-v2.jpg',
    alt: 'A glass of warm ghee water beside a jar of Country Dairy ghee',
    title: 'First thing',
    body: 'A spoon stirred into warm water, the way a lot of houses start the day.',
  },
  {
    image: '/images/ritual-cooking-v2.jpg',
    alt: 'Ghee poured from a spoon into a bowl of steaming dal beside a jar of Country Dairy ghee',
    title: 'In the tadka',
    body: 'For dal, for khichdi, and for everything else that begins with hot ghee.',
  },
  {
    image: '/images/ritual-topping-v2.jpg',
    alt: 'Ghee melting on a hot paratha on a steel plate beside a jar of Country Dairy ghee',
    title: 'On the plate',
    body: 'Over rotis, rice and vegetables, while they are still too hot to hold.',
  },
];

export default function Rituals() {
  const { ref, shown } = useReveal();

  return (
    <section ref={ref} className="bg-[var(--ivory)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`max-w-2xl transition-all duration-[900ms] ease-out ${
            shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-text)]">
            Every day
          </p>
          <h2 className="text-balance font-serif text-[clamp(28px,4vw,46px)] font-light leading-[1.08] tracking-[-0.012em] text-[var(--ink)]">
            Made for everyday rituals.
          </h2>
          <p className="mt-5 text-[15px] leading-[1.8] text-[var(--ink-soft)]">
            Not a jar that comes out for festivals. The one that stays next to the stove.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {RITUALS.map((ritual, i) => (
            <figure
              key={ritual.title}
              className={`transition-all duration-[900ms] ease-out ${
                shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
              }`}
              style={{ transitionDelay: `${140 + i * 90}ms` }}
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-[var(--sand)]">
                <Image
                  src={ritual.image}
                  alt={ritual.alt}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-5">
                <h3 className="font-serif text-[20px] font-normal leading-tight text-[var(--ink)]">
                  {ritual.title}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[14px] leading-[1.7] text-[var(--ink-soft)]">
                  {ritual.body}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
