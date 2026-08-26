'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star, Calendar, MessageCircle, Loader2, Check } from 'lucide-react';
import { PRODUCT_IMAGES, Product, resolveStorefrontImageUrl } from '../../lib/constants';
import { useStoreConfig } from '../../context/StoreConfigContext';
import { useApp } from '../../context/AppContext';
import { buildProductMessage, whatsAppUrl } from '../../lib/storeConfig';
import { trackStorefrontEvent } from '../../lib/analytics';

interface ProductCardProps {
  product: Product;
  /** Takes a variant id — price, SKU and stock all live on the variant. */
  onAddToCart: (
    variantId: string,
    quantity: number,
    optimistic?: {
      productId?: string;
      productName: string;
      variantLabel?: string;
      unitPrice: number;
      imageUrl?: string;
    },
  ) => void;
  onSubscribe?: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart, onSubscribe }: ProductCardProps) {
  // imageUrls[0] is the variant image when coming from getExpandedProducts (homepage shelf).
  // For base FALLBACK_PRODUCTS (e.g. "You May Also Like"), imageUrls[0] is a gallery image — skip it.
  const firstUrl = product.imageUrls?.[0] || (product as any).galleryImages?.[0]?.imageUrl;
  const isGalleryImage = firstUrl?.includes('-gallery-') || firstUrl?.includes('hero-') || firstUrl?.includes('hero_');
  const rawImage = (!isGalleryImage && firstUrl) || PRODUCT_IMAGES[product.slug] || '/images/products/ghee-jar.png';
  const imageSrc = resolveStorefrontImageUrl(rawImage);
  const defaultVariant = product.variants?.find((v) => v.isDefault) || product.variants?.[0];
  const displayPrice = defaultVariant ? defaultVariant.price : product.price;
  const displayOriginalPrice = defaultVariant ? defaultVariant.originalPrice : product.originalPrice;
  const discountBadge = defaultVariant?.discountPercent || product.discountBadge;
  const sizeLabel =
    defaultVariant?.volumeOrWeight || product.metadata?.volume || product.metadata?.weight || '';
  const productUrl = defaultVariant ? `/products/${product.slug}?variant=${defaultVariant.id}` : `/products/${product.slug}`;

  // Availability is derived from stock, with forceOutOfStock as the manual
  // override. OUT_OF_STOCK is no longer a product status.
  //
  // Stock may legitimately be undefined (the fallback catalogue carries no
  // stock), which is different from zero — only an actual 0 means sold out.
  const variantStock = (defaultVariant as { stockQuantity?: number } | undefined)?.stockQuantity;
  const isOutOfStock =
    (product as any).forceOutOfStock === true ||
    (product as any).status === 'ARCHIVED' ||
    variantStock === 0 ||
    (product.variants?.length
      ? product.variants.every((v) => (v as { stockQuantity?: number }).stockQuantity === 0)
      : false);

  const { whatsapp, isFlagOn } = useStoreConfig();
  const { pendingCartVariantId, lastAddedVariantId, cartError } = useApp();

  // Adding goes to the server, so the button has to say something while it
  // does. Previously nothing changed until the navbar count updated seconds
  // later, which read as a dead button.
  const isAdding = !!defaultVariant && pendingCartVariantId === defaultVariant.id;
  const justAdded = !!defaultVariant && lastAddedVariantId === defaultVariant.id;
  const cartEnabled = isFlagOn('ENABLE_CART');
  const ENABLE_PRODUCT_RATINGS = isFlagOn('ENABLE_PRODUCT_RATINGS');
  const ENABLE_SUBSCRIPTIONS = isFlagOn('ENABLE_SUBSCRIPTIONS');

  // Shown while there is no cart, and as a secondary option once there is.
  const whatsappHref =
    whatsapp?.isEnabled
      ? whatsAppUrl(
          whatsapp,
          buildProductMessage(whatsapp, {
            productName: product.name,
            variantLabel: defaultVariant?.volumeOrWeight,
            quantity: 1,
            unitPrice: Number(displayPrice) || 0,
          }),
        )
      : null;

  const handleWhatsAppClick = () => {
    trackStorefrontEvent({
      eventName: 'whatsapp_order_click',
      productId: product.id,
      productName: product.name,
      variantLabel: defaultVariant?.volumeOrWeight,
      price: typeof displayPrice === 'number' ? displayPrice : parseFloat(displayPrice as any) || 0,
    });
  };

  return (
    <article
      className={`group relative flex h-full flex-col ${isOutOfStock ? 'opacity-90' : ''}`}
    >
      {/*
       * No card, no border, no shadow. The photograph is the container: on a
       * cream ground a bordered white box adds a rectangle the eye has to read
       * before it reaches the product. Nine elements on the old card became
       * four that matter, and the rest either moved to the product page or
       * stopped repeating what the whole site already says.
       *
       * The panel is white rather than cream because every packshot in the
       * catalogue is a white studio shot. On cream the photograph's own
       * background showed as a white rectangle inside a warm one, which looks
       * like a bug. White makes the same pixels read as a deliberate plinth.
       */}
      <Link
        href={productUrl}
        className="relative block aspect-square overflow-hidden bg-white"
      >
        {discountBadge && !isOutOfStock && (
          <span className="absolute top-3 left-3 z-10 bg-[var(--forest)] text-[var(--ivory)] text-[10px] font-medium px-2.5 py-1 tracking-[0.1em] uppercase">
            {discountBadge}
          </span>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgb(var(--forest-rgb)/0.45)] backdrop-blur-[1px]">
            <span className="bg-[var(--ivory)] text-[var(--forest)] text-[10px] font-medium px-3.5 py-1.5 uppercase tracking-[0.14em]">
              Out of stock
            </span>
          </div>
        )}

        {/*
         * The seal stays on the card. The concept moved it to the product page,
         * but a test exists called "the seal is on product cards" because it is
         * a provenance signal rather than decoration, and the rule on this
         * branch is that the design yields to a flow rather than the other way
         * round. It is smaller and in the corner now, read as a mark rather
         * than as a sticker.
         */}
        {!isOutOfStock && (
          <img
            src="/badges/made-in-uttarakhand.jpg"
            alt="Made in Uttarakhand"
            className="pointer-events-none absolute bottom-3 right-3 z-10 h-10 w-10 rounded-full opacity-90 ring-1 ring-black/5"
          />
        )}

        <Image
          src={imageSrc}
          alt={product.name}
          fill
          className="object-contain p-5 transition-transform duration-[1200ms] ease-[cubic-bezier(.2,.7,.3,1)] group-hover:scale-[1.05]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />

        {/*
         * On a pointer device the primary action arrives on hover, which is
         * what the brief asks for. On touch there is no hover, so it is simply
         * always there. Hiding the buy button on a phone to honour a desktop
         * interaction would be the aesthetics-over-conversion trade the brief
         * explicitly rules out.
         */}
        {!isOutOfStock && cartEnabled && (
          <button
            onClick={(e) => {
              e.preventDefault();
              if (defaultVariant?.id) {
                onAddToCart(defaultVariant.id, 1, {
                  productId: product.id,
                  productName: product.name,
                  variantLabel: defaultVariant.volumeOrWeight,
                  unitPrice: Number(displayPrice) || 0,
                  imageUrl: rawImage,
                });
              }
            }}
            disabled={isAdding}
            className={`absolute inset-x-3 bottom-3 z-20 flex items-center justify-center gap-2 py-3.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-all duration-300 ease-[cubic-bezier(.2,.7,.3,1)] [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100 ${
              justAdded
                ? 'bg-[var(--forest)] text-[var(--ivory)]'
                : 'bg-[var(--ivory)] text-[var(--forest)] hover:bg-[var(--brass)] hover:text-[#1a1405] disabled:opacity-70'
            }`}
          >
            {justAdded ? <Check className="h-3.5 w-3.5" /> : isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {justAdded ? 'Added' : isAdding ? 'Adding' : 'Add to cart'}
          </button>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-4">
        {/* Only shown once a product actually has reviews. A card reading
            "0.0 (0)" describes a bad product rather than a new one. */}
        {ENABLE_PRODUCT_RATINGS && !!product.totalReviews && (
          <div className="mb-2 flex items-center gap-1.5">
            <Star className="h-3 w-3 fill-[var(--brass)] text-[var(--brass-text)]" />
            <span className="text-[12px] text-[var(--ink)] tabular">{(product.averageRating ?? 0).toFixed(1)}</span>
            <span className="text-[12px] text-[var(--ink-soft)]">({product.totalReviews})</span>
          </div>
        )}

        {product.badge && !isOutOfStock && (
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--brass-text)]">
            {product.badge}
          </p>
        )}

        <Link href={productUrl} data-testid="product-card-link" className="transition-colors hover:text-[var(--brass-text)]">
          <h3 className="font-serif text-[19px] leading-snug text-[var(--ink)]">
            {product.name}
          </h3>
        </Link>

        {/* Expanded variants already carry the size in the name — "… — 1 Litre
            Glass Jar" — and printing it again underneath reads as a mistake. */}
        {sizeLabel && !product.name.includes(sizeLabel) && (
          <p className="mt-1 text-[12px] tracking-[0.04em] text-[var(--ink-soft)]">{sizeLabel}</p>
        )}

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-[17px] text-[var(--ink)] tabular">&#8377;{displayPrice}</span>
          {displayOriginalPrice && (
            <span className="text-[12px] text-[var(--ink-soft)] line-through tabular">&#8377;{displayOriginalPrice}</span>
          )}
        </div>

        {isAdding === false && cartError && pendingCartVariantId === null && justAdded === false && (
          <p className="mt-2 text-[11px] text-[var(--terra)]">{cartError}</p>
        )}

        {/* Secondary routes stay, quietly, below the fold of the card. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {!isOutOfStock && whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-soft)] transition-colors hover:text-[#1DA851]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}

          {!isOutOfStock && ENABLE_SUBSCRIPTIONS && product.isSubscriptionAllowed && onSubscribe && (
            <button
              onClick={() => onSubscribe(product)}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-soft)] transition-colors hover:text-[var(--forest)]"
            >
              <Calendar className="h-3.5 w-3.5" />
              Subscribe
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
