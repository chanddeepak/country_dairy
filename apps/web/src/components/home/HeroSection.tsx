'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { HERO_IMAGE } from '../../lib/constants';

export default function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Full-width hero banner with farm image background */}
      <div className="relative w-full h-[520px] md:h-[600px]">
        {/* Background image */}
        <Image
          src={HERO_IMAGE}
          alt="Country Dairy organic farm with grazing cows"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />

        {/* Hero content overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <div className="max-w-xl space-y-6">
            <h1 className="font-serif font-black text-4xl sm:text-5xl md:text-6xl leading-tight text-white drop-shadow-lg">
              Farm Fresh. Organic.{' '}
              <span className="block">Pure Happiness.</span>
            </h1>
            <p className="text-white/85 text-base md:text-lg max-w-md leading-relaxed drop-shadow">
              Experience the finest A2 Milk & Organic Ghee, sourced
              directly from our happy cows on Country Dairy farm.
            </p>
            <a
              href="#shop"
              className="inline-flex items-center bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold px-8 py-4 rounded-sm uppercase tracking-wider text-sm shadow-lg transition-all hover:shadow-xl"
            >
              Shop All Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
