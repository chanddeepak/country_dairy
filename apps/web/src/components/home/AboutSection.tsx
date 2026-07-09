'use client';

import React from 'react';
import { Leaf, Heart, Shield, Truck } from 'lucide-react';

const storyPoints = [
  {
    icon: <Leaf className="h-6 w-6" />,
    title: 'Born on the Farm',
    description:
      'Country Dairy started as a single family farm in Haryana, raising native Gir and Sahiwal cows on open pastures — no factory floors, no shortcuts.',
  },
  {
    icon: <Heart className="h-6 w-6" />,
    title: 'Happy Cows, Pure Milk',
    description:
      'Our cows are grass-fed, free-range, and milked by hand. We believe that happy, healthy cows produce the purest A2 beta-casein milk.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'NABL Lab Verified',
    description:
      'Every batch is tested for adulterants — urea, starch, detergent, synthetic dyes — at NABL-accredited laboratories before it reaches you.',
  },
  {
    icon: <Truck className="h-6 w-6" />,
    title: 'Farm to Door, Same Day',
    description:
      'We deliver across Delhi NCR within hours of milking. Subscribe daily and never run out of fresh, organic dairy again.',
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-[#C59B27] font-bold text-xs uppercase tracking-[0.2em] mb-3">
            Our Story
          </p>
          <h2 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] mb-4">
            From Our Farm to Your Family
          </h2>
          <div className="w-16 h-0.5 bg-[#C59B27] mx-auto mb-6" />
          <p className="text-sm text-[#6b6661] leading-relaxed">
            We are a small team of farmers, dairy scientists, and delivery riders on a mission to
            bring genuinely pure, organic dairy products to families who care about what they consume.
            No middlemen, no additives — just honest food.
          </p>
        </div>

        {/* Story points grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {storyPoints.map((point) => (
            <div
              key={point.title}
              className="group text-center p-6 rounded-2xl border border-transparent hover:border-stone-200 hover:shadow-sm transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-[#3A6038]/10 text-[#3A6038] flex items-center justify-center group-hover:bg-[#3A6038] group-hover:text-white transition-colors duration-300">
                {point.icon}
              </div>
              <h4 className="font-bold text-sm text-[#2A2A2A] mb-2">{point.title}</h4>
              <p className="text-xs text-[#6b6661] leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
