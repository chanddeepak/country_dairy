'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const HERO_SLIDES = [
  {
    id: 1,
    image: '/images/himalayan-hero-banner-v2.png',
    objectPosition: 'center 35%',
    headline: 'Nourishment from the Himalayan Foothills.',
    subtitle: 'Experience the purity of A2 Vedic Ghee & Wood-Pressed Oils, crafted in Tanakpur, Uttarakhand.',
    ctaText: 'Shop All Products',
    ctaHref: '/products'
  },
  {
    id: 2,
    image: '/images/hero-banner-v2.png',
    objectPosition: 'center',
    headline: 'Pure A2 Vedic Ghee. Bilona Churned.',
    subtitle: 'Grass-fed Gir & Sahiwal cows grazing in pristine mountain pastures. Zero adulterants.',
    ctaText: 'Shop All Products',
    ctaHref: '/products'
  },
  {
    id: 3,
    image: '/images/hero-banner-3.png',
    objectPosition: 'center',
    headline: 'Raw Wild Forest Honey.',
    subtitle: '100% Raw, unfiltered, and ethically harvested from deep forest hives.',
    ctaText: 'Shop All Products',
    ctaHref: '/products'
  }
];

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isPaused) {
      interval = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % HERO_SLIDES.length);
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPaused]);

  return (
    <section 
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative w-full h-[520px] md:h-[600px]">
        {/* Slides */}
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Background image */}
            <Image
              src={slide.image}
              alt={slide.headline}
              fill
              className="object-cover scale-110 sm:scale-105 transition-transform duration-1000"
              style={{ objectPosition: slide.objectPosition || 'center' }}
              priority={index === 0}
              sizes="100vw"
            />
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />

            {/* Hero content overlay */}
            <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
              <div className="max-w-xl space-y-6">
                <div className="inline-flex items-center gap-1.5 bg-[#3A6038]/80 backdrop-blur-xs text-amber-200 border border-amber-300/30 px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest shadow-sm">
                  <span>⛰️ Devbhoomi Uttarakhand Origin</span>
                </div>
                <h1 className="font-serif font-black text-4xl sm:text-5xl md:text-6xl leading-tight text-white drop-shadow-lg">
                  {slide.headline.split('. ').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}{i < arr.length - 1 ? '.' : ''}
                      {i < arr.length - 1 && <span className="block" />}
                    </React.Fragment>
                  ))}
                </h1>
                <p className="text-white/90 text-base md:text-lg max-w-md leading-relaxed drop-shadow">
                  {slide.subtitle}
                </p>
                <Link
                  href={slide.ctaHref}
                  className="inline-flex items-center bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold px-8 py-4 rounded-sm uppercase tracking-wider text-sm shadow-lg transition-all hover:shadow-xl"
                >
                  {slide.ctaText}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Indicators */}
        <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center space-x-3">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'bg-white scale-110'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
