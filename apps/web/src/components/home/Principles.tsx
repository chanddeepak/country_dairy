'use client';

import React from 'react';
import { Mountain, Sprout, Flame, ShieldCheck, ScrollText, HeartHandshake } from 'lucide-react';
import { useReveal } from '../../lib/useReveal';

/**
 * Why Country Dairy, in the brief's six principles.
 *
 * The headings are the brief's. The sentences under them are not written fresh:
 * each one restates a claim the site already makes elsewhere — Tanakpur in the
 * announcement bar, free grazing and batch testing in the story, glass jars and
 * no additives in the section this replaces. A trust section is the worst place
 * on a homepage to introduce a claim nothing else supports.
 *
 * No cards and no icon circles. Six bordered white boxes on a warm ground are
 * six rectangles the eye has to get past; hairlines say the same thing about
 * grouping and say nothing else.
 *
 * The four "Learn More" buttons that used to sit here all scrolled to the same
 * anchor. One section link does that job.
 */
const PRINCIPLES = [
  {
    icon: Mountain,
    title: 'Himalayan Roots',
    body: 'Our farm sits in Tanakpur, Champawat, in the Kumaon foothills of Uttarakhand.',
  },
  {
    icon: Sprout,
    title: 'Thoughtfully Sourced',
    body: 'Milk from native desi cows that graze hill pastures freely and drink mountain spring water.',
  },
  {
    icon: Flame,
    title: 'Traditional Inspiration',
    body: 'Curd churned to butter and simmered slowly — the bilona method, not a cream separator.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality First',
    body: 'Batch-tested for fat purity, aroma and adulterants before a jar leaves the farm.',
  },
  {
    icon: ScrollText,
    title: 'Honest Products',
    body: 'No chemical solvents, no synthetic preservatives, no artificial additives.',
  },
  {
    icon: HeartHandshake,
    title: 'From Our Home to Yours',
    body: 'Hand-poured into recyclable glass jars and shipped across India.',
  },
];

export default function Principles() {
  const { ref, shown } = useReveal();

  return (
    <section id="values" ref={ref} className="scroll-mt-28 bg-[var(--ivory)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`max-w-2xl transition-all duration-[900ms] ease-out ${
            shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-text)]">
            Our principles
          </p>
          <h2 className="text-balance font-serif text-[clamp(28px,4vw,46px)] font-light leading-[1.08] tracking-[-0.012em] text-[var(--ink)]">
            Why Country Dairy
          </h2>
        </div>

        {/* Every cell is identical and carries a left rule; the wrapper clips
            the leftmost column's rule, so the lattice is correct at one, two
            or three columns without a single nth-child rule to get wrong. */}
        <div className="mt-12 overflow-hidden border-t border-[var(--line)]">
          <div className="-ml-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className={`border-b border-l border-[var(--line)] px-7 py-8 transition-all duration-[900ms] ease-out ${
                  shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
                }`}
                style={{ transitionDelay: `${120 + i * 70}ms` }}
              >
                <Icon className="h-[22px] w-[22px] text-[var(--brass-text)]" strokeWidth={1.25} />
                <h3 className="mt-5 font-serif text-[21px] font-normal leading-tight text-[var(--ink)]">
                  {title}
                </h3>
                <p className="mt-2.5 max-w-[34ch] text-[14px] leading-[1.7] text-[var(--ink-soft)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-[12px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
          We currently deliver across India only
        </p>
      </div>
    </section>
  );
}
