'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star, Calendar, MessageCircle, AlertCircle } from 'lucide-react';
import { PRODUCT_IMAGES, ENABLE_SUBSCRIPTIONS, ENABLE_WEBSITE_PAYMENT, WHATSAPP_NUMBER, WHATSAPP_MESSAGE_TEMPLATE, ENABLE_PRODUCT_RATINGS, Product, resolveStorefrontImageUrl } from '../../lib/constants';
import { trackStorefrontEvent } from '../../lib/analytics';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string, quantity: number) => void;
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
  const productUrl = defaultVariant ? `/products/${product.slug}?variant=${defaultVariant.id}` : `/products/${product.slug}`;

  // Availability is derived from stock, with forceOutOfStock as the manual
  // override. OUT_OF_STOCK is no longer a product status.
  const isOutOfStock =
    (product as any).forceOutOfStock === true ||
    (product as any).status === 'ARCHIVED' ||
    (defaultVariant && (defaultVariant as any).stockQuantity === 0) ||
    (product as any).stock === 0;

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
    <div className={`bg-white rounded-xl overflow-hidden group hover:shadow-xl transition-all duration-300 border border-stone-200/80 flex flex-col relative h-full ${isOutOfStock ? 'opacity-85' : ''}`}>
      {/* Product Image Container (Aspect Square + Object Contain to prevent any image truncation) */}
      <Link href={productUrl} className="relative aspect-square bg-[#FAF8F3] flex items-center justify-center overflow-hidden block">
        {/* Top Left Discount Badge */}
        {discountBadge && !isOutOfStock && (
          <span className="absolute top-3 left-3 z-10 bg-[#3A6038] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-sm shadow-sm tracking-wide">
            {discountBadge}
          </span>
        )}

        {/* Out of Stock Ribbon Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-stone-950/40 z-20 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-red-700 text-white font-black text-xs px-3.5 py-1.5 rounded uppercase tracking-widest shadow-lg border border-red-500/40 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Out of Stock
            </span>
          </div>
        )}

        {/* Top Right Highlight Tag */}
        {product.badge && !isOutOfStock && (
          <span className="absolute top-3 right-3 z-10 bg-[#C59B27] text-white text-[10px] font-bold px-2.5 py-1 rounded-sm shadow-sm tracking-wider uppercase">
            {product.badge}
          </span>
        )}

        <Image
          src={imageSrc}
          alt={product.name}
          fill
          className="object-contain group-hover:scale-105 transition-transform duration-500 p-4"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
      </Link>

      {/* Product Info */}
      <div className="p-4 flex flex-col flex-1">
        {ENABLE_PRODUCT_RATINGS && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star className="h-3.5 w-3.5 fill-[#C59B27] text-[#C59B27]" />
            <span className="text-xs font-bold text-[#2A2A2A]">{product.averageRating?.toFixed(1)}</span>
            <span className="text-xs text-[#6b6661]">({product.totalReviews})</span>
          </div>
        )}

        <div className="flex items-center gap-1 mb-1 text-[10px] text-[#3A6038] font-extrabold uppercase tracking-wider">
          <span>⛰️ Tanakpur, Uttarakhand</span>
        </div>

        <Link href={productUrl} className="hover:text-[#3A6038] transition">
          <h3 className="font-serif font-bold text-base text-[#2A2A2A] leading-snug mb-1 line-clamp-1">
            {product.name}
          </h3>
        </Link>

        <p className="text-[#6b6661] text-xs leading-relaxed line-clamp-2 mb-3 flex-1">
          {product.description}
        </p>

        {/* Pricing Block */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-black text-[#2A2A2A]">₹{displayPrice}</span>
          {displayOriginalPrice && (
            <span className="text-xs text-[#6b6661] line-through font-medium">₹{displayOriginalPrice}</span>
          )}
          <span className="text-xs text-[#6b6661] font-semibold ml-auto bg-stone-100 px-2 py-0.5 rounded text-[11px]">
            {defaultVariant?.volumeOrWeight || product.metadata?.volume || product.metadata?.weight || ''}
          </span>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2 mt-auto">
          {isOutOfStock ? (
            <button
              disabled
              className="w-full bg-stone-200 text-stone-500 font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <AlertCircle className="h-3.5 w-3.5" /> Out of Stock
            </button>
          ) : (
            <>
              {ENABLE_WEBSITE_PAYMENT && (
                <button
                  onClick={() => onAddToCart(product.id, 1)}
                  className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-sm"
                >
                  Add to Cart
                </button>
              )}
              
              {!ENABLE_WEBSITE_PAYMENT && (
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_TEMPLATE(product.name, displayPrice, defaultVariant?.volumeOrWeight))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleWhatsAppClick}
                  className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center shadow-sm"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Order on WhatsApp
                </a>
              )}
              
              {ENABLE_SUBSCRIPTIONS && product.isSubscriptionAllowed && onSubscribe && (
                <button
                  onClick={() => onSubscribe(product)}
                  className="w-full border border-[#3A6038] text-[#3A6038] hover:bg-[#3A6038]/5 font-bold py-2 rounded-lg text-xs flex items-center justify-center transition uppercase tracking-wider"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  Subscribe & Save
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
