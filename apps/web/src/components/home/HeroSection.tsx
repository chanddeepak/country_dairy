'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { API_URL } from '../../lib/constants';

const STATIC_HERO_SLIDES = [
  {
    id: 1,
    image: '/images/himalayan-hero-banner-v2.png',
    objectPosition: 'center 35%',
    headline: 'Nourishment from the Himalayan Foothills.',
    subtitle: '',
    headlineSize: 'text-2xl sm:text-3xl md:text-4xl',
    contentAlign: 'items-start pt-6 sm:pt-8 md:pt-10',
    ctaMarginTop: 'pt-1',
    ctaText: 'Shop All Products',
    ctaHref: '/products'
  },
  {
    id: 2,
    image: '/images/hero-banner-v2.png',
    objectPosition: 'center',
    headline: 'Pure A2 Vedic Ghee. Bilona Churned Method.',
    subtitle: 'Grass-fed desi cows grazing in pristine mountain pastures. Zero adulterants.',
    headlineSize: 'text-3xl sm:text-4xl md:text-5xl',
    contentAlign: 'items-center',
    ctaMarginTop: '',
    ctaText: 'Shop All Products',
    ctaHref: '/products'
  },
  {
    id: 3,
    image: '/images/hero-banner-3.png',
    objectPosition: 'center',
    headline: 'Pure A2 Bilona Desi Ghee.',
    subtitle: 'Nourished by pristine mountain flora in Devbhoomi Uttarakhand. 100% Pure, authentic & unadulterated.',
    headlineSize: 'text-3xl sm:text-4xl md:text-5xl',
    contentAlign: 'items-center',
    ctaMarginTop: '',
    ctaText: 'Shop All Products',
    ctaHref: '/products'
  }
];

export default function HeroSection() {
  const [slides, setSlides] = useState<any[]>(STATIC_HERO_SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    fetchHeroBanners();
  }, []);

  const fetchHeroBanners = async () => {
    try {
      const res = await fetch(`${API_URL}/cms/hero`);
      if (res.ok) {
        const banners = await res.json();
        if (banners && banners.length > 0) {
          const mapped = banners.map((b: any, idx: number) => ({
            id: b.id || idx,
            image: b.imageUrl || '/images/hero-banner.png',
            objectPosition: 'center',
            headline: b.title,
            subtitle: b.subtitle,
            ctaText: b.ctaText || 'Shop All Products',
            ctaHref: b.ctaLink || '/products',
          }));
          setSlides(mapped);
        }
      }
    } catch (err) {
      console.warn('API fetchHeroBanners warning:', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isPaused && slides.length > 0) {
      interval = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % slides.length);
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPaused, slides.length]);

  return (
    <section 
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative w-full h-[520px] md:h-[600px]">
        {/* Slides */}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Background image */}
            <Image
              src={slide.image}
              alt={slide.headline || 'Hero banner'}
              fill
              unoptimized={typeof slide.image === 'string' && (slide.image.startsWith('http') || slide.image.includes('/uploads/'))}
              className="object-cover scale-105 transition-transform duration-1000"
              style={{ objectPosition: slide.objectPosition || 'center' }}
              priority={index === 0}
              sizes="100vw"
            />
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-transparent" />

            {/* Hero content overlay */}
            <div className={`relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex ${slide.contentAlign || 'items-center'}`}>
              <div className="max-w-lg space-y-3.5">
                <div className="inline-flex items-center gap-1 bg-[#3A6038]/85 backdrop-blur-xs text-amber-200 border border-amber-300/30 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider shadow-sm">
                  <span>⛰️ Devbhoomi Uttarakhand Origin</span>
                </div>
                <h1 className={`font-serif font-black leading-tight text-white drop-shadow-lg ${slide.headlineSize || 'text-3xl sm:text-4xl md:text-5xl'}`}>
                  {(slide.headline || '').split('. ').map((part: string, i: number, arr: string[]) => (
                    <React.Fragment key={i}>
                      {part}{i < arr.length - 1 ? '.' : ''}
                      {i < arr.length - 1 && <span className="block" />}
                    </React.Fragment>
                  ))}
                </h1>
                {slide.subtitle && (
                  <p className="text-white/90 text-sm md:text-base max-w-md leading-relaxed drop-shadow">
                    {slide.subtitle}
                  </p>
                )}
                <div className={slide.ctaMarginTop || ''}>
                  <Link
                    href={slide.ctaHref || '/products'}
                    className="inline-flex items-center bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold px-6 py-3 rounded-sm uppercase tracking-wider text-xs sm:text-sm shadow-lg transition-all hover:shadow-xl"
                  >
                    {slide.ctaText || 'Shop All Products'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Indicators */}
        <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center space-x-3">
          {slides.map((_, index) => (
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
