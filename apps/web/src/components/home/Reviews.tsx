'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { API_URL } from '../../lib/constants';
import { useReveal } from '../../lib/useReveal';
import StarRating from '../ui/StarRating';

/**
 * What customers say, and — when nobody has said anything yet — a way to be the
 * first.
 *
 * The section is never hidden. An empty reviews section is not an embarrassment
 * to be conditionally removed; it is the only invitation a new shop can make,
 * and hiding it means the invitation never appears either.
 *
 * Reviews are per product in the API, so this asks the catalogue which products
 * actually have any and then only fetches those. Products with no reviews cost
 * no request, which is why the common case today is exactly two calls.
 */
interface HomeReview {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  createdAt: string;
  isVerifiedPurchase?: boolean;
  user?: { name?: string | null } | null;
  productTitle: string;
  productSlug: string;
}

interface CatalogueRow {
  id: string;
  slug: string;
  title?: string;
  name?: string;
  totalReviews?: number;
}

/** Four is enough for a homepage, and keeps this from fanning out over a big catalogue. */
const MAX_PRODUCTS = 4;
const MAX_REVIEWS = 3;

export default function Reviews({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { user } = useApp();
  const { ref, shown } = useReveal();
  const [reviews, setReviews] = useState<HomeReview[]>([]);
  const [writeHref, setWriteHref] = useState('/products');

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/catalog/products?status=LIVE`);
        if (!res.ok) return;
        const rows: CatalogueRow[] = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;

        if (live) setWriteHref(`/products/${rows[0].slug}`);

        const reviewed = rows.filter((r) => (r.totalReviews ?? 0) > 0).slice(0, MAX_PRODUCTS);
        const pages = await Promise.all(
          reviewed.map((product) =>
            fetch(`${API_URL}/products/${product.id}/reviews?pageSize=${MAX_REVIEWS}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((page) =>
                (page?.reviews ?? []).map((review: HomeReview) => ({
                  ...review,
                  productTitle: product.title ?? product.name ?? '',
                  productSlug: product.slug,
                })),
              )
              .catch(() => []),
          ),
        );

        if (!live) return;
        setReviews(
          pages
            .flat()
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, MAX_REVIEWS),
        );
      } catch {
        // No reviews rendered is the same as none written, and the invitation
        // below is the part that matters either way.
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  const rise = shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0';

  return (
    <section ref={ref} className="bg-[var(--cream)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`flex flex-wrap items-end justify-between gap-6 transition-all duration-[900ms] ease-out ${rise}`}
        >
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              In their kitchens
            </p>
            <h2 className="text-balance font-serif text-[clamp(28px,4vw,46px)] font-light leading-[1.08] tracking-[-0.012em] text-[var(--ink)]">
              What people say.
            </h2>
          </div>

          {user ? (
            <Link
              href={writeHref}
              className="inline-flex items-center rounded-sm border border-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forest)] transition-colors duration-300 hover:bg-[var(--forest)] hover:text-[var(--ivory)]"
            >
              Write a review
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAuthOpen}
              data-testid="reviews-sign-in"
              className="inline-flex items-center rounded-sm border border-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forest)] transition-colors duration-300 hover:bg-[var(--forest)] hover:text-[var(--ivory)]"
            >
              Sign in to review
            </button>
          )}
        </div>

        {reviews.length === 0 ? (
          <p
            className={`mt-10 border-t border-[var(--line)] pt-8 text-[15px] leading-[1.8] text-[var(--ink-soft)] transition-all delay-150 duration-[900ms] ease-out ${rise}`}
          >
            Nobody has written one yet. If you have cooked with it, yours would be the first.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, i) => (
              <figure
                key={review.id}
                data-testid="home-review"
                className={`border-t border-[var(--line)] pt-7 transition-all duration-[900ms] ease-out ${rise}`}
                style={{ transitionDelay: `${150 + i * 90}ms` }}
              >
                <StarRating rating={review.rating} />

                {review.title ? (
                  <h3 className="mt-4 font-serif text-[20px] font-normal leading-snug text-[var(--ink)]">
                    {review.title}
                  </h3>
                ) : null}

                {review.comment ? (
                  <blockquote className="mt-2.5 max-w-[40ch] text-[14px] leading-[1.75] text-[var(--ink-soft)]">
                    {review.comment}
                  </blockquote>
                ) : null}

                <figcaption className="mt-5 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  {review.user?.name || 'A customer'}
                  {review.isVerifiedPurchase ? (
                    <span className="text-[var(--brass)]"> · Verified purchase</span>
                  ) : null}
                  {review.productTitle ? (
                    <Link
                      href={`/products/${review.productSlug}`}
                      className="mt-1.5 block normal-case tracking-normal text-[12px] text-[var(--ink-soft)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:text-[var(--forest)]"
                    >
                      {review.productTitle}
                    </Link>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
