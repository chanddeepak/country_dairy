'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { heroLayoutClasses } from '../../lib/heroLayout';
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

function resolveStorefrontImageUrl(url?: string): string {
  if (!url) return '/images/hero-banner.png';
  if (url.startsWith('/hero-banners/') || url.startsWith('/products/')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return `${supabaseUrl}/storage/v1/object/public${url}`;
  }
  if (url.startsWith('/storage/v1/object/public/')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return `${supabaseUrl}${url}`;
  }
  if (url.startsWith('/uploads/')) {
    const apiHost = API_URL.replace(/\/api\/?$/, '');
    return `${apiHost}${url}`;
  }
  return url;
}
export default function HeroSection() {
  const [slides, setSlides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    fetchHeroBanners();
  }, []);

  const fetchHeroBanners = async () => {
    try {
      const [desktopRes, mobileRes] = await Promise.all([
        fetch(`${API_URL}/cms/hero?deviceType=DESKTOP`),
        fetch(`${API_URL}/cms/hero?deviceType=MOBILE`),
      ]);

      let desktopBanners: any[] = [];
      let mobileBanners: any[] = [];

      if (desktopRes.ok) desktopBanners = await desktopRes.json();
      if (mobileRes.ok) mobileBanners = await mobileRes.json();

      if (desktopBanners.length > 0 || mobileBanners.length > 0) {
        const primaryBanners = desktopBanners.length > 0 ? desktopBanners : mobileBanners;
        const mapped = primaryBanners.map((b: any, idx: number) => {
          const mobMatch = mobileBanners[idx] || mobileBanners[0] || b;
          return {
            id: b.id || idx,
            image: resolveStorefrontImageUrl(b.imageUrl || '/images/hero-banner.png'),
            mobileImage: resolveStorefrontImageUrl(mobMatch.imageUrl || b.imageUrl || '/images/hero-banner.png'),
            objectPosition: 'center',
            headline: b.title,
            subtitle: b.subtitle,
            // The column has existed since August and nothing read it. A
            // poster-style banner carries its own headline, so the storefront
            // must not lay a second one over the top.
            imageHasText: Boolean(b.imageHasText),
            ctaText: b.ctaText || 'Shop All Products',
            ctaHref: b.ctaLink || '/products',
            // The desktop row owns the placement; the mobile row is only
            // consulted for its artwork, since anchors are relative and
            // survive the narrower box on their own.
            layout: b.layout ?? null,
          };
        });
        setSlides(mapped);
      } else {
        setSlides(STATIC_HERO_SLIDES);
      }
    } catch (err) {
      console.warn('API fetchHeroBanners warning, using static slides fallback:', err);
      setSlides(STATIC_HERO_SLIDES);
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <section className="relative w-full overflow-hidden bg-[var(--forest)]">
        <div className="relative w-full h-[520px] md:h-[600px] bg-gradient-to-r from-[var(--forest)] via-[var(--pine)] to-[var(--forest)] animate-pulse flex items-center">
          {/* Shimmer background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink)]/80 via-[var(--forest)]/60 to-transparent" />
          
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-xl space-y-6">
              {/* Badge skeleton */}
              <div className="w-32 h-6 bg-[var(--pine)]/80 rounded-full border border-[var(--pine)]/50 animate-pulse" />
              
              {/* Headline skeleton lines */}
              <div className="space-y-3">
                <div className="w-3/4 h-10 md:h-14 bg-[var(--pine)]/90 rounded-sm animate-pulse" />
                <div className="w-1/2 h-10 md:h-14 bg-[var(--pine)]/90 rounded-sm animate-pulse" />
              </div>
              
              {/* Subtitle skeleton */}
              <div className="space-y-2 max-w-md pt-2">
                <div className="w-full h-4 bg-[var(--pine)]/70 rounded animate-pulse" />
                <div className="w-4/5 h-4 bg-[var(--pine)]/70 rounded animate-pulse" />
              </div>
              
              {/* CTA button skeleton */}
              <div className="pt-4">
                <div className="w-48 h-12 bg-[var(--warn)]/30 rounded-sm border border-[var(--warn)]/30 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Bottom indicator dots skeleton */}
          <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center space-x-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--pine)]/60 animate-pulse" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--pine)]/60 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative w-full h-[520px] md:h-[600px]">
        {/* Slides */}
        {slides.map((slide, index) => {
          // Per slide: each banner carries its own placement, and a slide with
          // no layout stored falls back to the original left-aligned stack.
          const layout = heroLayoutClasses((slide as { layout?: unknown }).layout);

          /*
           * Two ways the artwork speaks for itself: the flag says it carries
           * its own headline, or nobody has typed one. Today every banner in
           * the database has a title of whitespace, so the page was rendering
           * an empty badge, an empty h1 and a scrim over a finished poster.
           * An empty overlay is worse than no overlay.
           */
          const headline = String(slide.headline ?? '').trim();
          const showOverlay = !slide.imageHasText && headline.length > 0;

          return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Desktop Background Image (16:9) */}
            <div className="hidden md:block absolute inset-0">
              <Image
                src={slide.image}
                alt={slide.headline || 'Hero banner'}
                fill
                unoptimized={typeof slide.image === 'string' && (slide.image.startsWith('http') || slide.image.includes('/uploads/'))}
                className="object-cover animate-hero-drift"
                style={{ objectPosition: slide.objectPosition || 'center' }}
                priority={index === 0}
                sizes="100vw"
              />
            </div>
            {/* Mobile Background Image (4:3) */}
            <div className="block md:hidden absolute inset-0">
              <Image
                src={slide.mobileImage || slide.image}
                alt={slide.headline || 'Hero banner'}
                fill
                unoptimized={typeof (slide.mobileImage || slide.image) === 'string' && ((slide.mobileImage || slide.image).startsWith('http') || (slide.mobileImage || slide.image).includes('/uploads/'))}
                className="object-cover animate-hero-drift"
                style={{ objectPosition: slide.objectPosition || 'center' }}
                priority={index === 0}
                sizes="100vw"
              />
            </div>
            {/* Darkened only as much as the banner's own layout asks for, and
                not at all when there is no text to keep legible. */}
            {showOverlay && <div className={`absolute inset-0 ${layout.scrim}`} />}

            {/* Hero content overlay */}
            {showOverlay && (
            <div
              className={`relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full ${layout.container}`}
            >
              <div className={layout.block} style={layout.blockStyle}>
                <div className="inline-flex items-center gap-1 bg-[var(--forest)]/85 backdrop-blur-xs text-[var(--brass)] border border-[var(--warn-line)]/30 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider">
                  <span>Devbhoomi Uttarakhand Origin</span>
                </div>
                <h1 className={layout.headline}>
                  {headline.split('. ').map((part: string, i: number, arr: string[]) => (
                    <React.Fragment key={i}>
                      {part}{i < arr.length - 1 ? '.' : ''}
                      {i < arr.length - 1 && <span className="block" />}
                    </React.Fragment>
                  ))}
                </h1>
                {slide.subtitle && <p className={layout.subtitle}>{slide.subtitle}</p>}
                <div className={slide.ctaMarginTop || ''}>
                  <Link
                    href={slide.ctaHref || '/products'}
                    className="inline-flex items-center bg-[var(--brass)] hover:bg-[var(--forest)] text-[#1a1405] hover:text-[var(--ivory)] font-bold px-6 py-3 rounded-sm uppercase tracking-wider text-xs sm:text-sm shadow-lg transition-all"
                  >
                    {slide.ctaText || 'Shop All Products'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            )}
          </div>
          );
        })}

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
