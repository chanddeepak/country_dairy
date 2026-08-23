'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useNavTree } from '../../lib/useNavTree';
import { categoryIcon } from '../../lib/categoryIcon';
import ContourField from '../ui/ContourField';
import { resolveStorefrontImageUrl } from '../../lib/constants';

/**
 * Everything the brand brings down from the hills.
 *
 * The point of this section is that Country Dairy is not a ghee shop. It reads
 * the category tree, so the day someone adds Honey in the console it appears
 * here without a deploy, and the day the first honey product lands the tile
 * turns from a treatment into a photograph on its own.
 *
 * A category with nothing in it is shown rather than hidden. That is the honest
 * version of the brief's requirement: the architecture says a broader brand is
 * coming, and an empty shelf says the same thing without pretending it is
 * already stocked. What it must never do is show a photograph of ghee under the
 * word Honey.
 */

/** Grounds for the tiles that have no photograph yet, in brand order. */
const TREATMENTS = ['var(--forest)', 'var(--earth)', 'var(--pine)', 'var(--terra)'];

/**
 * As many columns as there are categories, to a maximum of four.
 *
 * A four column grid holding three tiles leaves a hole at the end that reads as
 * a missing image rather than as a layout. Literal classes because Tailwind
 * generates what it can see in the source; an interpolated grid-cols-${n}
 * produces no CSS at all.
 */
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export default function CollectionRow() {
  const { tree, loading } = useNavTree();

  /*
   * The header is static text, so it renders immediately rather than after the
   * fetch. Hiding it and then revealing it moved everything below it down —
   * 0.375 of the homepage's 0.66 cumulative layout shift came from this one
   * element. The padding and grid match the loaded state exactly for the same
   * reason.
   */
  const header = (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-text)]">
          The collection
        </p>
        <h2 className="max-w-[16ch] font-serif text-[clamp(28px,4vw,46px)] font-light leading-[1.08] tracking-[-0.012em] text-[var(--ink)]">
          Everything we bring down from the hills.
        </h2>
      </div>
      <Link
        href="/products"
        className="inline-flex items-center rounded-sm border border-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forest)] transition-colors duration-300 hover:bg-[var(--forest)] hover:text-[var(--ivory)]"
      >
        Shop all
      </Link>
    </div>
  );

  if (loading) {
    return (
      <section className="bg-[var(--cream)] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {header}
          <div className={`grid animate-pulse gap-3.5 ${COLUMNS[3]}`}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[3/4] bg-[var(--sand)]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (tree.length === 0) return null;

  return (
    <section className="bg-[var(--cream)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {header}

        <div className={`grid gap-3.5 ${COLUMNS[Math.min(tree.length, 4)] ?? COLUMNS[4]}`}>
          {tree.map((cat, i) => {
            const Icon = categoryIcon(cat.iconName);
            const image = cat.imageUrl ? resolveStorefrontImageUrl(cat.imageUrl) : null;
            const stocked = cat.productCount > 0;

            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                data-testid="collection-tile"
                className="group relative block aspect-[3/4] overflow-hidden"
                style={image ? undefined : { background: TREATMENTS[i % TREATMENTS.length] }}
              >
                {image ? (
                  <>
                    <Image
                      src={image}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(.2,.7,.3,1)] group-hover:scale-[1.06]"
                    />
                    {/* Deep enough at the foot that the name reads over a bright
                        photograph. A gentle wash is not enough on these. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(20,38,28,0) 22%, rgba(20,38,28,.55) 58%, rgba(18,34,25,.93) 100%)',
                      }}
                    />
                  </>
                ) : (
                  <ContourField tone="brass" opacity={0.5} />
                )}

                <div className="absolute inset-x-6 bottom-6 z-10 text-[var(--ivory)]">
                  {!image && (
                    <Icon className="mb-4 h-6 w-6 text-[var(--brass-text)]" strokeWidth={1.4} />
                  )}
                  <h3 className="font-serif text-[24px] leading-tight">{cat.name}</h3>
                  <p className="mt-2 text-[12px] font-light leading-relaxed text-[var(--sand)]/80">
                    {stocked
                      ? cat.description ||
                        `${cat.productCount} ${cat.productCount === 1 ? 'product' : 'products'}`
                      : 'Arriving through the year'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
