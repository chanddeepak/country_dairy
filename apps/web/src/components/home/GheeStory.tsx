'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { API_URL, resolveStorefrontImageUrl } from '../../lib/constants';
import { useReveal } from '../../lib/useReveal';
import ContourField from '../ui/ContourField';

/**
 * The ghee, given the room the brief asks for.
 *
 * Every word below the headline comes out of the product record — the story the
 * console already holds, and the specifications already entered against it.
 * Writing this section's copy into the source would mean the homepage and the
 * product page could drift apart, and only one of them would be corrected when
 * the shelf life changes.
 *
 * The product is found by its shelf rather than by slug, so renaming the ghee
 * or replacing it with next season's does not leave the homepage pointing at a
 * dead page. If no ghee is live, the section is simply not there.
 */

interface StoryProduct {
  slug: string;
  title?: string;
  name?: string;
  tagline?: string;
  storyDescription?: string;
  isFeatured?: boolean;
  categoryName?: string;
  parentCategorySlug?: string;
  specifications?: Record<string, string> | null;
  galleryImages?: { imageUrl: string }[];
}

/**
 * The gallery on this product is marketing posters — nutrition panels, claim
 * lists, all with lettering baked into the pixels. None of them can be dropped
 * into an editorial layout. This is the packshot with its white studio ground
 * keyed out, so the jar sits on the forest rather than in a white box.
 *
 * Tied to the slug it actually depicts: if the featured ghee is ever a
 * different product, the section falls back to that product's own photograph
 * rather than showing this jar under someone else's name.
 */
const CUTOUT_SLUG = 'country-dairy-a2-vedic-ghee';
const CUTOUT = '/images/products/a2-desi-ghee-cutout.png';

function pickGhee(products: StoryProduct[]): StoryProduct | null {
  const ghee = products.filter((p) => p.parentCategorySlug === 'ghee');
  if (ghee.length === 0) return null;
  return ghee.find((p) => p.isFeatured) ?? ghee[0];
}

export default function GheeStory() {
  const { ref, shown } = useReveal();
  const [product, setProduct] = useState<StoryProduct | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${API_URL}/catalog/products?status=LIVE`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: StoryProduct[]) => {
        if (live) setProduct(pickGhee(Array.isArray(rows) ? rows : []));
      })
      .catch(() => {
        // The homepage still works without this section; a shelf that failed to
        // load is not worth an error state on a brand page.
      });
    return () => {
      live = false;
    };
  }, []);

  if (!product) return null;

  const paragraphs = (product.storyDescription ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const specs = Object.entries(product.specifications ?? {});
  const gallery = product.galleryImages?.[0]?.imageUrl;
  const image =
    product.slug === CUTOUT_SLUG ? CUTOUT : gallery ? resolveStorefrontImageUrl(gallery) : null;
  const rise = shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0';

  return (
    <section ref={ref} className="relative overflow-hidden bg-[var(--forest)] py-20 sm:py-28">
      <ContourField tone="brass" spacing={46} opacity={0.16} className="absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className={`lg:col-span-5 transition-all duration-[900ms] ease-out ${rise}`}>
            {image ? (
              <div className="relative mx-auto aspect-[3/4] w-full max-w-[250px] sm:max-w-[320px] lg:max-w-[380px]">
                <Image
                  src={image}
                  alt={product.title ?? product.name ?? 'Country Dairy ghee'}
                  fill
                  sizes="(min-width: 1024px) 34vw, 80vw"
                  className="object-contain [filter:drop-shadow(0_28px_36px_rgba(0,0,0,0.45))]"
                />
              </div>
            ) : null}
          </div>

          <div
            className={`lg:col-span-7 transition-all delay-150 duration-[900ms] ease-out ${rise}`}
          >
            {product.categoryName ? (
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-on-dark)]">
                {product.categoryName}
              </p>
            ) : null}

            <h2 className="text-balance font-serif text-[clamp(28px,4.2vw,50px)] font-light leading-[1.1] tracking-[-0.015em] text-[var(--ivory)]">
              Golden purity from the hills.
            </h2>

            <div className="mt-6 space-y-4">
              {paragraphs.map((text) =>
                /* The record ends in two lines that are slogans rather than
                   prose. They are set as such instead of being dropped. */
                text.length < 70 ? (
                  <p
                    key={text}
                    className="font-serif text-[19px] italic leading-snug text-[var(--brass-on-dark)]"
                  >
                    {text}
                  </p>
                ) : (
                  <p key={text} className="max-w-[62ch] text-[15px] leading-[1.8] text-[var(--sand)]">
                    {text}
                  </p>
                ),
              )}
            </div>

            {specs.length > 0 ? (
              <dl className="mt-9 grid grid-cols-1 gap-x-10 gap-y-5 border-t border-[rgb(var(--ivory-rgb)/0.15)] pt-8 sm:grid-cols-2">
                {specs.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--brass-on-dark)]">
                      {label}
                    </dt>
                    <dd className="mt-1.5 text-[14px] leading-relaxed text-[var(--ivory)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <Link
              href={`/products/${product.slug}`}
              className="mt-9 inline-flex items-center rounded-sm border border-[rgb(var(--ivory-rgb)/0.35)] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ivory)] transition-colors duration-300 hover:bg-[var(--ivory)] hover:text-[var(--forest)]"
            >
              See the ghee
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
