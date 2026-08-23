'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Minus, Plus, Calendar, ShoppingBag, MessageCircle, Share2, Check, Truck, Headphones, RotateCcw, ClipboardCheck, Loader2, Droplet, CookingPot, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import StarRating from '../../../components/ui/StarRating';
import ReviewSection from '../../../components/product/ReviewSection';
import LabReportPanel from '../../../components/product/LabReportPanel';
import { trackStorefrontEvent } from '../../../lib/analytics';
import { mapApiProducts } from '../../../lib/mapProduct';
import ProductCard from '../../../components/product/ProductCard';
import AuthModal from '../../../components/modals/AuthModal';
import SubscriptionModal from '../../../components/modals/SubscriptionModal';
import CartDrawer from '../../../components/cart/CartDrawer';
import { FALLBACK_PRODUCTS, API_URL, PRODUCT_IMAGES, HERO_IMAGE, Product, ProductVariant, resolveStorefrontImageUrl } from '../../../lib/constants';
import { useStoreConfig } from '../../../context/StoreConfigContext';
import { buildProductMessage, whatsAppUrl } from '../../../lib/storeConfig';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const variantIdFromQuery = searchParams?.get('variant');
  const { user, token, addToCart, pendingCartVariantId, lastAddedVariantId, cartError } =
    useApp();
  const { whatsapp, isFlagOn } = useStoreConfig();
  const cartEnabled = isFlagOn('ENABLE_CART');
  const ENABLE_PRODUCT_RATINGS = isFlagOn('ENABLE_PRODUCT_RATINGS');
  const ENABLE_SUBSCRIPTIONS = isFlagOn('ENABLE_SUBSCRIPTIONS');

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  // Owned by ReviewSection, lifted so the header can show the same numbers.
  const [reviewSummary, setReviewSummary] = useState({ averageRating: 0, totalReviews: 0 });
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'bilonaProcess' | 'details'>('details');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  /**
   * Ghee is the product the bilona story is about, so it opens on that story
   * rather than on a specification table. Lifted out of the tab renderer
   * because the default tab has to know it before anything is drawn.
   */
  const isGheeProduct = useMemo(() => {
    if (!product) return false;
    const haystack = [
      product.slug,
      product.name,
      (product as any).categoryName,
      (product as any).categoryLabel,
    ];
    return haystack.some((value) => typeof value === 'string' && value.toLowerCase().includes('ghee'));
  }, [product]);

  // Keyed on the product, not on isGheeProduct alone, so switching products
  // resets the tab while a reader who chose Product Details on this one keeps
  // their choice.
  useEffect(() => {
    setActiveTab(isGheeProduct ? 'bilonaProcess' : 'details');
  }, [product?.id]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubscrOpen, setIsSubscrOpen] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }
  }, [slug, variantIdFromQuery]);

  const fetchProduct = async () => {
    try {
      // 1. Fetch live product details from backend API
      const res = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const liveProd = await res.json();
        if (liveProd && (liveProd.id || liveProd.title)) {
          setupProductData(liveProd);
          return;
        }
      }
    } catch (err) {
      console.warn('[Storefront] Failed to fetch live product by slug/id, using fallback catalog:', err);
    }

    // 2. Fallback matching for static demo items
    const fb = FALLBACK_PRODUCTS.find((p) => 
      p.slug === slug || 
      p.id === slug || 
      slug.startsWith(p.slug) || 
      p.variants?.some((v) => v.id === slug || `${p.id}-${v.id}` === slug || `${p.slug}-${v.id}` === slug)
    ) || FALLBACK_PRODUCTS.find((p) => slug.includes(p.slug)) || FALLBACK_PRODUCTS[0];

    setupProductData(fb);
  };

  const setupProductData = (prod: any) => {
    if (!prod) return;

    const formattedVariants = prod.variants?.map((v: any) => ({
      id: v.id,
      name: v.name || v.sizeLabel || 'Standard Pack',
      volumeOrWeight: v.volumeOrWeight || v.sizeLabel || '1 Litre',
      // No fallback figure. A price the API did not send is unknown, and
      // inventing ₹100 is how a customer once got quoted a number nobody set.
      price: v.price ?? v.sellingPrice ?? null,
      originalPrice: v.originalPrice ?? v.mrpPrice ?? null,
      discountPercent: v.discountPercent || (v.mrpPrice && v.sellingPrice ? `${Math.round(((v.mrpPrice - v.sellingPrice) / v.mrpPrice) * 100)}% OFF` : ''),
      image: v.image || v.imageUrl,
      isDefault: v.isDefault ?? false,
      // Was dropped in this mapping, so the page had no idea what was in
      // stock and happily sold a variant with none — the customer found out
      // at checkout when the API refused it.
      stockQuantity: typeof v.stockQuantity === 'number' ? v.stockQuantity : null,
    })) || [];

    const defaultVar = (variantIdFromQuery && formattedVariants.find((v: any) => v.id === variantIdFromQuery))
      || formattedVariants.find((v: any) => v.isDefault)
      || formattedVariants[0]
      || null;

    const catLabel = typeof prod.category === 'string'
      ? prod.category
      : prod.category?.name || prod.categoryName || 'A2 Dairy';

    const basePrice = defaultVar ? defaultVar.price : (prod.price ?? prod.variants?.[0]?.sellingPrice ?? null);
    const baseOriginalPrice = defaultVar
      ? defaultVar.originalPrice
      : (prod.originalPrice ?? prod.variants?.[0]?.mrpPrice ?? null);

    const normalizedProd = {
      ...prod,
      name: prod.title || prod.name || 'Country Dairy Product',
      price: basePrice,
      originalPrice: baseOriginalPrice,
      categoryLabel: catLabel,
      variants: formattedVariants.length > 0 ? formattedVariants : prod.variants,
    };

    setProduct(normalizedProd);
    setSelectedVariant(defaultVar);

    const initialImg = defaultVar?.image || PRODUCT_IMAGES[prod.slug] || prod.galleryImages?.[0]?.imageUrl || prod.imageUrls?.[0] || '/images/products/ghee-jar.png';
    setActiveImage(resolveStorefrontImageUrl(initialImg));

    void loadRelated(prod);
  };

  /**
   * Other things to buy, from the live catalogue.
   *
   * This used to read FALLBACK_PRODUCTS, a hardcoded list holding one product
   * — the ghee. So the section showed a single card on every other page and
   * nothing at all on the ghee's own page, where the filter removed the only
   * entry it had. Nothing here has ever reflected what is actually on sale.
   *
   * Same category first, because a ghee buyer is likelier to want another
   * ghee, then anything else live to fill the row.
   */
  const loadRelated = async (current: any) => {
    try {
      const res = await fetch(`${API_URL}/catalog/products?status=LIVE`);
      if (!res.ok) return;

      const live = await res.json();
      if (!Array.isArray(live)) return;

      const others = mapApiProducts(live).filter(
        (p) => p.id !== current.id && p.slug !== current.slug,
      );

      const currentCategory = current.categoryLabel ?? current.category;
      const sameCategory = others.filter((p) => p.category && p.category === currentCategory);
      const rest = others.filter((p) => !sameCategory.includes(p));

      setRelatedProducts([...sameCategory, ...rest].slice(0, 3));
    } catch (err) {
      // A dead recommendations row is not worth breaking the page over.
      console.warn('Could not load related products:', err);
    }
  };

  // Feeds the "Most Viewed Products" panel on the admin dashboard.
  useEffect(() => {
    if (!product?.id) return;
    trackStorefrontEvent({
      eventName: 'product_view',
      productId: product.id,
      productName: product.name,
    });
  }, [product?.id, product?.name]);

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);

    const vImg = variant.image || (variant as any).imageUrl;
    const variantLabel = variant.volumeOrWeight || (variant as any).name || (variant as any).sizeLabel;

    // 1. Check if variant has direct primary image assigned
    // 2. Or check if galleryImages has an image tagged with this variantId & isVariantPrimary
    const variantPrimaryGalleryImg = (product as any)?.galleryImages?.find((g: any) => 
      (g.variantId === variant.id || (variantLabel && g.variantId === variantLabel)) && g.isVariantPrimary
    )?.imageUrl;

    const anyVariantGalleryImg = (product as any)?.galleryImages?.find((g: any) => 
      g.variantId === variant.id || (variantLabel && g.variantId === variantLabel)
    )?.imageUrl;

    const sharedPrimaryImg = (product as any)?.galleryImages?.find((g: any) => g.isPrimary && !g.variantId)?.imageUrl 
      || (product as any)?.galleryImages?.find((g: any) => g.isPrimary)?.imageUrl;

    const targetImg = vImg || variantPrimaryGalleryImg || anyVariantGalleryImg || sharedPrimaryImg || '/images/products/milk-bottle.png';
    setActiveImage(resolveStorefrontImageUrl(targetImg));
  };

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.href;
    const shareTitle = product?.name || 'Country Dairy';

    if (navigator.share && typeof navigator.share === 'function') {
      navigator.share({
        title: shareTitle,
        text: `Check out ${shareTitle} on Country Dairy!`,
        url: shareUrl,
      }).catch(() => {
        copyToClipboard(shareUrl);
      });
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof window === 'undefined') return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showCopyToast();
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showCopyToast();
    } catch {
      alert(`Product Link: ${text}`);
    }
  };

  const showCopyToast = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!product) {
    /**
     * A skeleton in the shape of the real page rather than a line of text in
     * the middle of an empty screen. It holds the layout still, so nothing
     * jumps when the product arrives, and it reads as "this is loading"
     * without anyone having to word it.
     */
    const bar = 'rounded bg-[var(--sand)]/80';

    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

        <main className="flex-1 bg-[var(--ivory)]">
          <div
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse"
            role="status"
            aria-label="Loading product"
          >
            {/* Breadcrumb */}
            <div className={`h-3 w-56 mb-8 ${bar}`} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Gallery */}
              <div className="space-y-3">
                <div className={`aspect-square w-full ${bar}`} />
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-16 w-16 ${bar}`} />
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-5 pt-2">
                <div className={`h-3 w-28 ${bar}`} />
                <div className={`h-8 w-4/5 ${bar}`} />
                <div className={`h-4 w-2/5 ${bar}`} />

                <div className="space-y-2 pt-2">
                  <div className={`h-3 w-full ${bar}`} />
                  <div className={`h-3 w-11/12 ${bar}`} />
                  <div className={`h-3 w-3/5 ${bar}`} />
                </div>

                {/* Size options */}
                <div className="flex gap-2 pt-2">
                  {[0, 1].map((i) => (
                    <div key={i} className={`h-11 w-28 ${bar}`} />
                  ))}
                </div>

                <div className={`h-9 w-40 ${bar}`} />
                <div className={`h-12 w-full ${bar}`} />
              </div>
            </div>
          </div>

          <span className="sr-only">Loading product details</span>
        </main>

        <Footer />
      </div>
    );
  }

  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  // Null means the API sent no price for this variant. That is a catalogue
  // fault, and the honest response is to say so and refuse the sale rather
  // than quote a number nobody set.
  const hasPrice = currentPrice !== null && currentPrice !== undefined && currentPrice !== '';
  const priceValue = Number(currentPrice);
  const priceIsUsable = hasPrice && Number.isFinite(priceValue) && priceValue > 0;

  // Null means the API did not say, which is not the same as zero: treat an
  // unknown as available and let the server be the authority, but never offer
  // a variant we have been told is empty.
  const stock = selectedVariant?.stockQuantity ?? null;
  const isOutOfStock = stock !== null && stock <= 0;
  const canBuy = priceIsUsable && !isOutOfStock;
  const currentOriginalPrice = selectedVariant ? selectedVariant.originalPrice : product.originalPrice;
  const currentDiscountBadge = selectedVariant?.discountPercent || product.discountBadge;
  const nutrition = product.nutritionFacts || {};
  const metadata = product.metadata || {};

  // Variant-driven dynamic packaging & net quantity
  const volStr = selectedVariant?.volumeOrWeight || (selectedVariant as any)?.sizeLabel || metadata.volume || metadata.weight || '1 Litre';
  const currentVolumeOrWeight = volStr;
  const currentPackaging = (
    volStr.includes('Dolchi') ? 'Traditional Metal Dolchi' :
    volStr.includes('Tin') ? 'Food-Grade Tin Can' :
    volStr.includes('Bottle') ? 'Glass Bottle' :
    volStr.includes('Canister') ? 'Family Canister' :
    metadata.packaging || 'Glass Jar'
  );

  const dynamicDetails = {
    'Net Quantity / Volume': currentVolumeOrWeight,
    'Packaging Type': currentPackaging,
    'Standard Serving Size': '100g / 100ml',
    'Shelf Life': metadata.shelfLife || '12 months',
    'Storage Instructions': 'Store in a cool, dry place away from direct sunlight. Keep container tightly sealed after use.',
  };

  // Filter gallery images specific to current selected variant + shared/unlinked photos
  const selectedVariantLabel = selectedVariant?.volumeOrWeight || (selectedVariant as any)?.name || (selectedVariant as any)?.sizeLabel;
  const rawGallery = (product as any)?.galleryImages || [];
  
  const relevantGallery = rawGallery.filter((gi: any) => {
    if (!gi.variantId) return true; // Shared photo across all variants
    if (gi.variantId === selectedVariant?.id) return true;
    if (selectedVariantLabel && gi.variantId === selectedVariantLabel) return true;
    return false; // Skip photos linked specifically to OTHER variants
  });

  const variantPrimaryImg = selectedVariant?.image || (selectedVariant as any)?.imageUrl;
  const rawPrimary = rawGallery.find((g: any) => g.isPrimary);
  const productPrimaryImg = (!rawPrimary?.variantId || rawPrimary?.variantId === selectedVariant?.id || rawPrimary?.variantId === selectedVariantLabel)
    ? rawPrimary?.imageUrl
    : null;

  const galleryPool = [
    variantPrimaryImg,
    productPrimaryImg,
    ...relevantGallery.map((g: any) => g.imageUrl),
  ].filter(Boolean) as string[];
  const allImages = Array.from(new Set(galleryPool));

  /**
   * Move through the gallery from the main image itself.
   *
   * The thumbnails below already switch it, but on a phone they sit under the
   * fold — someone looking at the jar has no way to see the second photograph
   * without scrolling away from it. Wraps at both ends so neither arrow is
   * ever a dead control.
   */
  const stepImage = (direction: 1 | -1) => {
    if (allImages.length < 2) return;
    const resolvedActive = resolveStorefrontImageUrl(activeImage);
    const current = allImages.findIndex(
      (img) => resolveStorefrontImageUrl(img) === resolvedActive,
    );
    const from = current === -1 ? 0 : current;
    const next = (from + direction + allImages.length) % allImages.length;
    setActiveImage(resolveStorefrontImageUrl(allImages[next]));
  };

  const galleryThumbnails = allImages.map((imgUrl, index) => ({
    id: `thumb-${index}`,
    url: imgUrl,
    label: index === 0 ? 'Main Product' : index === 1 ? 'Farm & Quality' : 'Lab Certificate',
  }));

  // Mirrors ProductCard: the request is in flight, or it just landed. The
  // detail page had neither, so pressing Add to Cart looked like nothing had
  // happened until the header badge quietly changed a second later.
  const isAdding = !!selectedVariant?.id && pendingCartVariantId === selectedVariant.id;
  const justAdded = !!selectedVariant?.id && lastAddedVariantId === selectedVariant.id;

  const handleAddToCart = () => {
    // No sign-in gate. A guest can fill a cart from the homepage and the all
    // products page, and their cart merges on sign-in — demanding an account
    // here only on the detail page turned the most considered click on the
    // site into a login wall.
    if (!selectedVariant?.id) return;
    if (!canBuy) return;
    addToCart(selectedVariant.id, quantity, {
      productId: product.id,
      productName: product.name,
      variantLabel: selectedVariant.volumeOrWeight,
      unitPrice: Number(currentPrice) || 0,
      imageUrl: activeImage,
    });
  };

  const whatsappHref = whatsapp?.isEnabled
    ? whatsAppUrl(
        whatsapp,
        buildProductMessage(whatsapp, {
          productName: product.name,
          variantLabel: selectedVariant?.volumeOrWeight || selectedVariant?.name,
          quantity,
          unitPrice: Number(currentPrice) || 0,
        }),
      )
    : null;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[var(--ivory)]">
        {/* Top Header / Breadcrumb Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <nav className="flex items-center text-xs text-[var(--ink-soft)] gap-1">
            <Link href="/" className="hover:text-[var(--forest)] transition">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/products" className="hover:text-[var(--forest)] transition">Shop</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[var(--ink)] font-bold truncate max-w-[200px] sm:max-w-none">{product.name}</span>
          </nav>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink-soft)] hover:text-[var(--forest)] bg-white border border-[var(--line)] px-3.5 py-1.5 rounded-full transition hover:shadow"
            title="Share Product"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-[var(--ok)]" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className={copiedLink ? 'text-[var(--ok)] font-extrabold' : ''}>
              {copiedLink ? 'Link Copied!' : 'Share'}
            </span>
          </button>
        </div>

        {/* Product Main Section (Items-Start for Sticky Left Column) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            
            {/* Left Column: Interactive Sticky Image Gallery */}
            <div className="space-y-4 lg:sticky lg:top-24">
              {/* Main Preview Image */}
              <div className="relative aspect-square bg-white rounded-sm overflow-hidden border border-[var(--line)] flex items-center justify-center">
                {currentDiscountBadge && (
                  <span className="absolute top-4 left-4 z-10 bg-[var(--forest)] text-white text-xs font-extrabold px-3 py-1 rounded-sm tracking-wide">
                    {currentDiscountBadge}
                  </span>
                )}
                {product.badge && (
                  <span className="absolute top-4 right-4 z-10 bg-[var(--brass)] text-white text-xs font-bold px-3 py-1 rounded-sm tracking-wider uppercase">
                    {product.badge}
                  </span>
                )}
                <Image
                  src={resolveStorefrontImageUrl(activeImage)}
                  alt={product.name || 'Country Dairy Product Image'}
                  data-testid="gallery-main"
                  fill
                  className="object-contain p-2 sm:p-4 transition-all duration-300"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  loading="eager"
                />

                {/* Only where there is somewhere to go. A single-photograph
                    product showing arrows promises more than it has. */}
                {allImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => stepImage(-1)}
                      aria-label="Previous image"
                      data-testid="gallery-prev"
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 hover:bg-white border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stepImage(1)}
                      aria-label="Next image"
                      data-testid="gallery-next"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 hover:bg-white border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {/* Which of how many — otherwise the arrows give no sense
                        of where you are in the set. */}
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-[var(--ink-soft)] bg-white/85 border border-[var(--line)] rounded-full px-2.5 py-1">
                      {Math.max(
                        1,
                        allImages.findIndex(
                          (img) =>
                            resolveStorefrontImageUrl(img) ===
                            resolveStorefrontImageUrl(activeImage),
                        ) + 1,
                      )}{' '}
                      / {allImages.length}
                    </span>
                  </>
                )}
              </div>

              {/* Gallery Thumbnails Row */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {galleryThumbnails.map((thumb) => {
                  const resolvedActive = resolveStorefrontImageUrl(activeImage);
                  const resolvedThumb = resolveStorefrontImageUrl(thumb.url);
                  const isSelected = resolvedActive === resolvedThumb || activeImage === thumb.url;
                  return (
                    <button
                      key={thumb.id}
                      onClick={() => setActiveImage(thumb.url)}
                      className={`relative w-20 h-20 bg-white rounded-sm overflow-hidden border-2 transition-all flex-shrink-0 p-1.5 ${
                        isSelected
                          ? 'border-[var(--forest)] ring-2 ring-[var(--forest)]/20 scale-95'
                          : 'border-[var(--line)] hover:border-[var(--forest)]/50 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={resolveStorefrontImageUrl(thumb.url)}
                        alt={`${product.name || 'Product'} thumbnail - ${thumb.label}`}
                        fill
                        className="object-contain p-1"
                        sizes="80px"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Product Info, Variant Selector, Description & Trust Badges */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--forest)] bg-[var(--forest)]/10 px-2.5 py-1 rounded-full">
                    {(product as any).categoryLabel || (typeof product.category === 'string' ? product.category : (product.category as any)?.name) || (product as any).categoryName || 'A2 Dairy'}
                  </span>
                  <span className="text-xs text-[var(--ink-soft)]">•</span>
                  <span className="text-xs text-[var(--ink-soft)]">{currentPackaging}</span>
                  <span className="text-xs text-[var(--ink-soft)]">•</span>
                  <span className="text-xs font-semibold text-[var(--forest)] bg-[var(--cream)] px-2 py-0.5 rounded">
                    {currentVolumeOrWeight}
                  </span>
                </div>
                <h1 className="font-serif font-light text-3xl md:text-4xl text-[var(--ink)] leading-tight mb-2">
                  {product.name}
                </h1>
                <p className="text-xs font-semibold text-[var(--ink-soft)] tracking-wide uppercase">
                  BILONA CHURNED | A2-VERIFIED | 70+ QUALITY CHECKS
                </p>
              </div>

              {/* Rating */}
              {/* Hidden entirely with no reviews — "0.0 (0 reviews)" is noise,
                  and the count and average used to come from different sources,
                  which produced "0.0 (1 reviews)". */}
              {ENABLE_PRODUCT_RATINGS && reviewSummary.totalReviews > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={reviewSummary.averageRating} size="md" />
                  <span className="text-sm font-bold text-[var(--ink)]">{reviewSummary.averageRating.toFixed(1)}</span>
                  <span className="text-xs text-[var(--ink-soft)]">
                    ({reviewSummary.totalReviews} {reviewSummary.totalReviews === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}

              {/* Price Display */}
              <div className="flex items-baseline gap-3 pt-1">
                {priceIsUsable ? (
                  <span className="text-4xl font-black text-[var(--ink)]">
                    ₹{priceValue.toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span className="text-lg font-bold text-[var(--ink-soft)]">Price unavailable</span>
                )}
                {isOutOfStock && (
                  <span className="text-xs font-extrabold text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-line)] px-2 py-0.5 rounded">
                    OUT OF STOCK
                  </span>
                )}
                {priceIsUsable && currentOriginalPrice && (
                  <span className="text-lg text-[var(--ink-soft)] line-through font-medium">₹{currentOriginalPrice}</span>
                )}
                {currentDiscountBadge && (
                  <span className="text-xs font-extrabold text-[var(--forest)] bg-[var(--forest)]/10 px-2 py-0.5 rounded">
                    {currentDiscountBadge}
                  </span>
                )}
              </div>

              {/* Tagline / Short Subtitle */}
              <p className="text-sm font-semibold italic text-[var(--forest)] leading-relaxed flex items-center gap-2">
                {product.tagline || product.description}
              </p>

              {/* Provenance seal, beside the product rather than over it.
                  There is room here for the artwork to be legible and for the
                  words it carries at print size to be written out — which is
                  what the 56px version on a card cannot do. Nothing covers the
                  photograph, which is what actually sells food. */}
              <div className="flex items-center gap-3 bg-[var(--ivory)] border border-[var(--line)] rounded-sm p-3">
                <img
                  src="/badges/made-in-uttarakhand.jpg"
                  alt=""
                  className="w-16 h-16 rounded-full shrink-0 ring-1 ring-black/5"
                />
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">Made in Uttarakhand</p>
                  <p className="text-[11px] text-[var(--ink-soft)] leading-snug">
                    Pure hills, pure cows, pure milk, pure ghee — churned in Tanakpur,
                    in the foothills of Devbhoomi.
                  </p>
                </div>
              </div>

              {/* VARIANT SELECTOR */}
              {product.variants && product.variants.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-[var(--ink)] block mb-3 uppercase tracking-wider">
                    Select Variant:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {product.variants.map((variant) => {
                      const isSelected = selectedVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          data-testid="variant-option"
                          data-variant-id={variant.id}
                          onClick={() => handleVariantSelect(variant)}
                          className={`p-3 rounded-sm border-2 text-left transition-all relative ${
                            isSelected
                              ? 'border-[var(--forest)] bg-[var(--forest)]/5'
                              : 'border-[var(--line)] bg-white hover:border-[var(--forest)]/40'
                          }`}
                        >
                          <span className="block font-bold text-xs text-[var(--ink)] mb-1">
                            {variant.volumeOrWeight || variant.name}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-extrabold text-sm text-[var(--ink)]">₹{variant.price}</span>
                            {variant.originalPrice && (
                              <span className="text-[10px] text-[var(--ink-soft)] line-through">₹{variant.originalPrice}</span>
                            )}
                          </div>
                          {variant.discountPercent && (
                            <span className="text-[9px] font-bold text-[var(--forest)] block mt-1">
                              {variant.discountPercent}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="pt-2">
                <span className="text-xs font-bold text-[var(--ink)] block mb-2 uppercase tracking-wider">
                  Quantity:
                </span>
                <div className="flex items-center gap-3 bg-white border border-[var(--line)] rounded-sm w-fit px-3 py-1.5">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 hover:bg-[var(--cream)] rounded transition">
                    <Minus className="h-4 w-4 text-[var(--ink)]" />
                  </button>
                  <span className="font-black text-lg text-[var(--ink)] w-6 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="p-1 hover:bg-[var(--cream)] rounded transition">
                    <Plus className="h-4 w-4 text-[var(--ink)]" />
                  </button>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3 pt-4">
                {cartEnabled && (
                  <>
                    <button
                      onClick={handleAddToCart}
                      disabled={isAdding || !canBuy}
                      data-testid="add-to-cart"
                      className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-sm text-sm uppercase tracking-wider transition disabled:opacity-60 disabled:cursor-not-allowed ${
                        justAdded
                          ? 'bg-[var(--pine)] text-white'
                          : 'bg-[var(--forest)] hover:bg-[var(--pine)] text-white'
                      }`}
                    >
                      {justAdded ? (
                        <Check className="h-4 w-4" />
                      ) : isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingBag className="h-4 w-4" />
                      )}
                      {justAdded
                        ? 'Added to Cart'
                        : isAdding
                          ? 'Adding…'
                          : isOutOfStock
                            ? 'Out of Stock'
                            : priceIsUsable
                              ? `Add to Cart — ₹${(priceValue * quantity).toLocaleString('en-IN')}`
                              : 'Price unavailable'}
                    </button>

                    {cartError && !isAdding && !justAdded && (
                      <p className="text-xs font-medium text-[var(--danger)] text-center">{cartError}</p>
                    )}
                  </>
                )}
                
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackStorefrontEvent({
                        eventName: 'whatsapp_order_click',
                        productId: product.id,
                        productName: product.name,
                        variantLabel: selectedVariant?.volumeOrWeight,
                        price: Number(currentPrice) || 0,
                      })
                    }
                    className={
                      cartEnabled
                        ? 'w-full flex items-center justify-center border-2 border-[#25D366] text-[#1DA851] hover:bg-[#25D366]/5 font-bold py-3 rounded-sm text-sm uppercase tracking-wider transition'
                        : 'w-full flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-sm text-sm uppercase tracking-wider transition'
                    }
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Order on WhatsApp — ₹{Number(currentPrice) * quantity}
                  </a>
                )}
                
                {ENABLE_SUBSCRIPTIONS && product.isSubscriptionAllowed && (
                  <button
                    onClick={() => {
                      if (!user) { setIsAuthOpen(true); return; }
                      setIsSubscrOpen(true);
                    }}
                    className="w-full flex items-center justify-center border-2 border-[var(--forest)] text-[var(--forest)] hover:bg-[var(--forest)]/5 font-bold py-3 rounded-sm text-sm uppercase tracking-wider transition"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Subscribe Daily — ₹{Math.round(Number(currentPrice) * 0.9)}
                  </button>
                )}
              </div>

              {/* DETAILED PRODUCT DESCRIPTION SECTION */}
              <div className="pt-6 border-t border-[var(--line)]/80 space-y-3">
                <h3 className="font-serif font-light text-sm text-[var(--ink)] uppercase tracking-wider">
                  Product Description
                </h3>
                <div className="text-sm text-[var(--ink-soft)] leading-relaxed space-y-3">
                  <p>
                    {product.storyDescription || product.description}
                  </p>
                  <p>
                    Every batch is lab-tested before dispatch so what reaches your kitchen is 100% pure, unadulterated, and crafted with uncompromised quality.
                  </p>
                </div>

                {/* Trust Badges Grid (Matching Reference Screenshot) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[var(--line)]/60">
                  <div className="flex flex-col items-center text-center p-3.5 rounded-sm bg-white border border-[var(--line)]/60">
                    <Truck className="h-6 w-6 text-[var(--forest)] mb-2" />
                    <span className="text-xs font-bold text-[var(--ink)] mb-0.5">Free Shipping</span>
                    <span className="text-[10px] text-[var(--ink-soft)]">Orders Above ₹499</span>
                  </div>
                  <div className="flex flex-col items-center text-center p-3.5 rounded-sm bg-white border border-[var(--line)]/60">
                    <Headphones className="h-6 w-6 text-[var(--forest)] mb-2" />
                    <span className="text-xs font-bold text-[var(--ink)] mb-0.5">360° Support</span>
                    <span className="text-[10px] text-[var(--ink-soft)]">Always Here to Help</span>
                  </div>
                  <div className="flex flex-col items-center text-center p-3.5 rounded-sm bg-white border border-[var(--line)]/60">
                    <RotateCcw className="h-6 w-6 text-[var(--forest)] mb-2" />
                    <span className="text-xs font-bold text-[var(--ink)] mb-0.5">100% Purity</span>
                    <span className="text-[10px] text-[var(--ink-soft)]">Guaranteed Fresh</span>
                  </div>
                  <div className="flex flex-col items-center text-center p-3.5 rounded-sm bg-white border border-[var(--line)]/60">
                    <ClipboardCheck className="h-6 w-6 text-[var(--forest)] mb-2" />
                    <span className="text-xs font-bold text-[var(--ink)] mb-0.5">70+ Checks</span>
                    <span className="text-[10px] text-[var(--ink-soft)]">Lab Tested Quality</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Tabs: Vedic Bilona Process / Details */}
          {(() => {
            const tabsToRender = isGheeProduct ? (['bilonaProcess', 'details'] as const) : (['details'] as const);

            return (
              <div className="mt-16">
                <div className="flex border-b border-[var(--line)]">
                  {tabsToRender.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-3 text-sm font-bold transition border-b-2 -mb-px ${
                        activeTab === tab
                          ? 'border-[var(--forest)] text-[var(--forest)]'
                          : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {tab === 'bilonaProcess' ? 'Traditional Vedic Process' : 'Product Details'}
                    </button>
                  ))}
                </div>
                <div className="bg-white border border-t-0 border-[var(--line)] rounded-b-xl p-6">
                  {isGheeProduct && activeTab === 'bilonaProcess' ? (
                <div className="max-w-4xl mx-auto space-y-8 py-2">
                  {/* Header Banner */}
                  <div className="bg-[var(--ivory)] border border-[var(--line)]/80 rounded-sm p-6 text-center space-y-2">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--forest)] bg-[var(--forest)]/10 px-3 py-1 rounded-full">
                      Himalayan Heritage & Craftsmanship
                    </span>
                    <h3 className="font-serif font-light text-2xl md:text-3xl text-[var(--ink)]">
                      The 5-Step Traditional Vedic Bilona Process
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--ink-soft)] max-w-2xl mx-auto leading-relaxed">
                      Handcrafted in Tanakpur, Uttarakhand using authentic curd-churning techniques. Unlike commercial cream-churned ghee, Vedic Bilona Ghee retains maximum natural aroma, A2 beta-casein purity, and granular Pahadi texture.
                    </p>
                  </div>

                  {/* 5 Steps Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-[var(--ivory)]/60 border border-[var(--line)]/80 rounded-sm p-4 flex flex-col items-center text-center space-y-2.5 hover:border-[var(--forest)] transition">
                      <div className="w-10 h-10 rounded-full bg-[var(--forest)] text-[var(--brass)] font-serif font-light text-lg flex items-center justify-center">
                        1
                      </div>
                      <h4 className="font-serif font-normal text-[var(--ink)] text-sm">Free-Range Grazing</h4>
                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                        Native Desi cows graze freely in pesticide-free mountain pastures, drinking fresh Himalayan spring water.
                      </p>
                    </div>

                    <div className="bg-[var(--ivory)]/60 border border-[var(--line)]/80 rounded-sm p-4 flex flex-col items-center text-center space-y-2.5 hover:border-[var(--forest)] transition">
                      <div className="w-10 h-10 rounded-full bg-[var(--forest)] text-[var(--brass)] font-serif font-light text-lg flex items-center justify-center">
                        2
                      </div>
                      <h4 className="font-serif font-normal text-[var(--ink)] text-sm">Whole Curd Culturing</h4>
                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                        Fresh A2 milk is boiled slowly in traditional vessels and naturally cultured into thick whole curd overnight.
                      </p>
                    </div>

                    <div className="bg-[var(--ivory)]/60 border border-[var(--line)]/80 rounded-sm p-4 flex flex-col items-center text-center space-y-2.5 hover:border-[var(--forest)] transition">
                      <div className="w-10 h-10 rounded-full bg-[var(--forest)] text-[var(--brass)] font-serif font-light text-lg flex items-center justify-center">
                        3
                      </div>
                      <h4 className="font-serif font-normal text-[var(--ink)] text-sm">Wooden Bilona Churning</h4>
                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                        Curd is churned bi-directionally with a wooden bilona to gently separate pure Makhan (butter) from buttermilk.
                      </p>
                    </div>

                    <div className="bg-[var(--ivory)]/60 border border-[var(--line)]/80 rounded-sm p-4 flex flex-col items-center text-center space-y-2.5 hover:border-[var(--forest)] transition">
                      <div className="w-10 h-10 rounded-full bg-[var(--forest)] text-[var(--brass)] font-serif font-light text-lg flex items-center justify-center">
                        4
                      </div>
                      <h4 className="font-serif font-normal text-[var(--ink)] text-sm">Slow Fire Simmering</h4>
                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                        Makhan is slowly simmered on low heat to yield golden liquid ghee with its signature granular (danedar) texture.
                      </p>
                    </div>

                    <div className="bg-[var(--ivory)]/60 border border-[var(--line)]/80 rounded-sm p-4 flex flex-col items-center text-center space-y-2.5 hover:border-[var(--forest)] transition">
                      <div className="w-10 h-10 rounded-full bg-[var(--forest)] text-[var(--brass)] font-serif font-light text-lg flex items-center justify-center">
                        5
                      </div>
                      <h4 className="font-serif font-normal text-[var(--ink)] text-sm">Hand-Poured Purity</h4>
                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                        Strained through fine cloth and hand-poured into glass jars & traditional stainless-steel dolchis for dispatch.
                      </p>
                    </div>
                  </div>

                  {/* Purity Comparison Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 bg-[var(--ok-bg)]/50 border border-[var(--ok-line)]/60 rounded-sm flex items-start gap-3">
                      <Droplet className="h-[18px] w-[18px] shrink-0 text-[var(--ok)]" strokeWidth={1.5} />
                      <div>
                        <h5 className="font-bold text-xs text-[var(--forest)] uppercase tracking-wider mb-0.5">100% Curd Churned</h5>
                        <p className="text-xs text-[var(--ink-soft)] leading-relaxed">Never made from raw industrial cream. 25-30 litres of A2 milk yields just 1 litre of Bilona ghee.</p>
                      </div>
                    </div>
                    <div className="p-4 bg-[var(--warn-bg)]/50 border border-[var(--warn-line)]/60 rounded-sm flex items-start gap-3">
                      <CookingPot className="h-[18px] w-[18px] shrink-0 text-[var(--brass)]" strokeWidth={1.5} />
                      <div>
                        <h5 className="font-bold text-xs text-[var(--brass)] uppercase tracking-wider mb-0.5">Rich Granular Aroma</h5>
                        <p className="text-xs text-[var(--ink-soft)] leading-relaxed">Natural golden colour, nutty Pahadi aroma, and bio-available nutrients intact.</p>
                      </div>
                    </div>
                    <div className="p-4 bg-[var(--cream)] border border-[var(--line)]/80 rounded-sm flex items-start gap-3">
                      <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-[var(--ink-soft)]" strokeWidth={1.5} />
                      <div>
                        <h5 className="font-bold text-xs text-[var(--ink)] uppercase tracking-wider mb-0.5">Zero Additives</h5>
                        <p className="text-xs text-[var(--ink-soft)] leading-relaxed">No preservatives, synthetic colours, or chemical solvents. Certified 100% pure.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 text-sm text-[var(--ink-soft)]">
                  {/* Nutritional Facts Table from DB */}
                  {(product as any).nutritionFacts && Object.keys((product as any).nutritionFacts).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-serif font-light text-sm text-[var(--ink)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--line)] pb-2">
                        Nutritional Facts & Metrics
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries((product as any).nutritionFacts).map(([key, val]) => (
                          <div key={key} className="flex justify-between items-center p-3 rounded-sm bg-[var(--ivory)]/80 border border-[var(--line)]/80">
                            <span className="font-bold text-[var(--ink)] text-xs">{key}</span>
                            <span className="font-extrabold text-[var(--forest)] text-xs font-mono">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Batch lab results, hidden when nothing is published */}
                  <LabReportPanel productId={(product as any).id} />

                  {/* Product Specifications & Packaging Details */}
                  <div className="space-y-3">
                    <h4 className="font-serif font-light text-sm text-[var(--ink)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--line)] pb-2">
                      Product Specifications & Packaging
                    </h4>
                    <div className="space-y-2.5">
                      {Object.entries(dynamicDetails).map(([key, value]) => (
                        <div key={key} className="flex justify-between border-b border-[var(--line)] pb-2 items-center text-xs">
                          <span className="font-bold text-[var(--ink)]">{key}</span>
                          <span className="font-medium text-[var(--ink)]">{value as string}</span>
                        </div>
                      ))}
                      {(product as any).specifications && Object.entries((product as any).specifications).map(([key, val]) => {
                        if (dynamicDetails[key as keyof typeof dynamicDetails]) return null;
                        return (
                          <div key={key} className="flex justify-between border-b border-[var(--line)] pb-2 items-center text-xs">
                            <span className="font-bold text-[var(--ink)]">{key}</span>
                            <span className="font-medium text-[var(--ink)]">{String(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
                </div>
              </div>
            );
          })()}

          {/* Reviews Section */}
          {ENABLE_PRODUCT_RATINGS && (
            <div className="mt-16">
              <ReviewSection
                productId={product.id}
                token={token}
                currentUserId={user?.id}
                onRequestSignIn={() => setIsAuthOpen(true)}
                onSummaryChange={setReviewSummary}
              />
            </div>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16">
              <h2 className="font-serif font-light text-2xl text-[var(--ink)] mb-8">You May Also Like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SubscriptionModal isOpen={isSubscrOpen} onClose={() => setIsSubscrOpen(false)} product={product} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onCheckout={() => router.push('/checkout')} />
    </div>
  );
}
