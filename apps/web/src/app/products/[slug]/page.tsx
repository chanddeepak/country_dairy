'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Minus, Plus, Calendar, ShoppingBag, MessageCircle, Share2, Check, Truck, Headphones, RotateCcw, ClipboardCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import StarRating from '../../../components/ui/StarRating';
import ReviewSummary from '../../../components/product/ReviewSummary';
import ReviewCard from '../../../components/product/ReviewCard';
import ReviewForm from '../../../components/product/ReviewForm';
import ProductCard from '../../../components/product/ProductCard';
import AuthModal from '../../../components/modals/AuthModal';
import SubscriptionModal from '../../../components/modals/SubscriptionModal';
import CartDrawer from '../../../components/cart/CartDrawer';
import { FALLBACK_PRODUCTS, API_URL, PRODUCT_IMAGES, HERO_IMAGE, ENABLE_SUBSCRIPTIONS, ENABLE_WEBSITE_PAYMENT, WHATSAPP_NUMBER, WHATSAPP_MESSAGE_TEMPLATE, ENABLE_PRODUCT_RATINGS, Product, ProductVariant, resolveStorefrontImageUrl } from '../../../lib/constants';

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const variantIdFromQuery = searchParams?.get('variant');
  const { user, token, addToCart } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'bilonaProcess' | 'details'>('bilonaProcess');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
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
      price: String(v.price ?? v.sellingPrice ?? 100),
      originalPrice: String(v.originalPrice ?? v.mrpPrice ?? 120),
      discountPercent: v.discountPercent || (v.mrpPrice && v.sellingPrice ? `${Math.round(((v.mrpPrice - v.sellingPrice) / v.mrpPrice) * 100)}% OFF` : ''),
      image: v.image || v.imageUrl,
      isDefault: v.isDefault ?? false,
    })) || [];

    const defaultVar = (variantIdFromQuery && formattedVariants.find((v: any) => v.id === variantIdFromQuery))
      || formattedVariants.find((v: any) => v.isDefault)
      || formattedVariants[0]
      || null;

    const catLabel = typeof prod.category === 'string'
      ? prod.category
      : prod.category?.name || prod.categoryName || 'A2 Dairy';

    const basePrice = defaultVar ? defaultVar.price : String(prod.price ?? prod.variants?.[0]?.sellingPrice ?? 100);
    const baseOriginalPrice = defaultVar ? defaultVar.originalPrice : String(prod.originalPrice ?? prod.variants?.[0]?.mrpPrice ?? 120);

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

    setRelatedProducts(FALLBACK_PRODUCTS.filter((p) => p.slug !== prod.slug).slice(0, 3));
  };

  useEffect(() => {
    if (product?.id && ENABLE_PRODUCT_RATINGS) {
      fetch(`${API_URL}/products/${product.id}/reviews`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setReviews(Array.isArray(data) ? data : []))
        .catch(() => setReviews([]));
    }
  }, [product?.id]);

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    // Use variant-specific image if available, otherwise fall back to product-level image
    const newImage = variant.image || (product ? PRODUCT_IMAGES[product.slug] : undefined) || product?.imageUrls?.[0] || '/images/products/ghee-jar.png';
    setActiveImage(resolveStorefrontImageUrl(newImage));
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
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-[#6b6661]">Loading product details...</div>
        </div>
        <Footer />
      </div>
    );
  }

  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
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

  // Always include the product's primary image in the gallery.
  // activeImage is used only for highlight state — all images stay visible at all times.
  const productPrimaryImage = selectedVariant?.image || PRODUCT_IMAGES[product.slug];
  const galleryPool = [
    productPrimaryImage,
    ...(product.imageUrls || []),
    ...(product.secondaryImages || []),
  ].filter(Boolean) as string[];
  const allImages = Array.from(new Set(galleryPool));

  const galleryThumbnails = allImages.map((imgUrl, index) => ({
    id: `thumb-${index}`,
    url: imgUrl,
    label: index === 0 ? 'Main Product' : index === 1 ? 'Farm & Quality' : 'Lab Certificate',
  }));

  const handleAddToCart = () => {
    if (!user) { setIsAuthOpen(true); return; }
    addToCart(product.id, quantity);
  };

  const whatsappMessage = WHATSAPP_MESSAGE_TEMPLATE(
    product.name,
    currentPrice,
    selectedVariant?.volumeOrWeight || selectedVariant?.name,
    quantity
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[#FAF8F3]">
        {/* Top Header / Breadcrumb Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <nav className="flex items-center text-xs text-[#6b6661] gap-1">
            <Link href="/" className="hover:text-[#3A6038] transition">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/products" className="hover:text-[#3A6038] transition">Shop</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[#2A2A2A] font-bold truncate max-w-[200px] sm:max-w-none">{product.name}</span>
          </nav>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-bold text-[#6b6661] hover:text-[#3A6038] bg-white border border-stone-200 px-3.5 py-1.5 rounded-full transition shadow-sm hover:shadow"
            title="Share Product"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className={copiedLink ? 'text-emerald-700 font-extrabold' : ''}>
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
              <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm flex items-center justify-center">
                {currentDiscountBadge && (
                  <span className="absolute top-4 left-4 z-10 bg-[#3A6038] text-white text-xs font-extrabold px-3 py-1 rounded-sm shadow-sm tracking-wide">
                    {currentDiscountBadge}
                  </span>
                )}
                {product.badge && (
                  <span className="absolute top-4 right-4 z-10 bg-[#C59B27] text-white text-xs font-bold px-3 py-1 rounded-sm shadow-sm tracking-wider uppercase">
                    {product.badge}
                  </span>
                )}
                <Image
                  src={resolveStorefrontImageUrl(activeImage)}
                  alt={product.name || 'Country Dairy Product Image'}
                  fill
                  className="object-contain p-2 sm:p-4 transition-all duration-300"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  loading="eager"
                />
              </div>

              {/* Gallery Thumbnails Row */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {galleryThumbnails.map((thumb) => {
                  const isSelected = activeImage === thumb.url;
                  return (
                    <button
                      key={thumb.id}
                      onClick={() => setActiveImage(thumb.url)}
                      className={`relative w-20 h-20 bg-white rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 p-1.5 ${
                        isSelected
                          ? 'border-[#3A6038] shadow-md ring-2 ring-[#3A6038]/20 scale-95'
                          : 'border-stone-200 hover:border-[#3A6038]/50 opacity-70 hover:opacity-100'
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
                  <span className="text-xs font-bold uppercase tracking-wider text-[#3A6038] bg-[#3A6038]/10 px-2.5 py-1 rounded-full">
                    {typeof (product as any).category === 'string' ? (product as any).category : (product as any).category?.name || (product as any).categoryLabel || 'A2 Dairy'}
                  </span>
                  <span className="text-xs text-[#6b6661]">•</span>
                  <span className="text-xs text-[#6b6661]">{currentPackaging}</span>
                  <span className="text-xs text-[#6b6661]">•</span>
                  <span className="text-xs font-semibold text-[#3A6038] bg-stone-100 px-2 py-0.5 rounded">
                    {currentVolumeOrWeight}
                  </span>
                </div>
                <h1 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] leading-tight mb-2">
                  {product.name}
                </h1>
                <p className="text-xs font-semibold text-[#6b6661] tracking-wide uppercase">
                  BILONA CHURNED | A2-VERIFIED | 70+ QUALITY CHECKS
                </p>
              </div>

              {/* Rating */}
              {ENABLE_PRODUCT_RATINGS && (
                <div className="flex items-center gap-2">
                  <StarRating rating={product.averageRating || 0} size="md" />
                  <span className="text-sm font-bold text-[#2A2A2A]">{(product.averageRating || 0).toFixed(1)}</span>
                  <span className="text-xs text-[#6b6661]">({product.totalReviews || reviews.length} reviews)</span>
                </div>
              )}

              {/* Price Display */}
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-4xl font-black text-[#2A2A2A]">₹{currentPrice}</span>
                {currentOriginalPrice && (
                  <span className="text-lg text-[#6b6661] line-through font-medium">₹{currentOriginalPrice}</span>
                )}
                {currentDiscountBadge && (
                  <span className="text-xs font-extrabold text-[#3A6038] bg-[#3A6038]/10 px-2 py-0.5 rounded">
                    {currentDiscountBadge}
                  </span>
                )}
              </div>

              {/* Tagline / Short Subtitle */}
              <p className="text-sm font-semibold italic text-[#3A6038] leading-relaxed flex items-center gap-2">
                <span>✨</span> {product.tagline || product.description}
              </p>

              {/* VARIANT SELECTOR */}
              {product.variants && product.variants.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-[#2A2A2A] block mb-3 uppercase tracking-wider">
                    Select Variant:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {product.variants.map((variant) => {
                      const isSelected = selectedVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => handleVariantSelect(variant)}
                          className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                            isSelected
                              ? 'border-[#3A6038] bg-[#3A6038]/5 shadow-sm'
                              : 'border-stone-200 bg-white hover:border-[#3A6038]/40'
                          }`}
                        >
                          <span className="block font-bold text-xs text-[#2A2A2A] mb-1">
                            {variant.volumeOrWeight || variant.name}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-extrabold text-sm text-[#2A2A2A]">₹{variant.price}</span>
                            {variant.originalPrice && (
                              <span className="text-[10px] text-[#6b6661] line-through">₹{variant.originalPrice}</span>
                            )}
                          </div>
                          {variant.discountPercent && (
                            <span className="text-[9px] font-bold text-[#3A6038] block mt-1">
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
                <span className="text-xs font-bold text-[#2A2A2A] block mb-2 uppercase tracking-wider">
                  Quantity:
                </span>
                <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg w-fit px-3 py-1.5 shadow-sm">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 hover:bg-stone-100 rounded transition">
                    <Minus className="h-4 w-4 text-[#2A2A2A]" />
                  </button>
                  <span className="font-black text-lg text-[#2A2A2A] w-6 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="p-1 hover:bg-stone-100 rounded transition">
                    <Plus className="h-4 w-4 text-[#2A2A2A]" />
                  </button>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3 pt-4">
                {ENABLE_WEBSITE_PAYMENT && (
                  <button
                    onClick={handleAddToCart}
                    className="w-full flex items-center justify-center bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider transition shadow-md hover:shadow-lg"
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Add to Cart — ₹{Number(currentPrice) * quantity}
                  </button>
                )}
                
                {!ENABLE_WEBSITE_PAYMENT && (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider transition shadow-md hover:shadow-lg"
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
                    className="w-full flex items-center justify-center border-2 border-[#3A6038] text-[#3A6038] hover:bg-[#3A6038]/5 font-bold py-3 rounded-xl text-sm uppercase tracking-wider transition"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Subscribe Daily — ₹{Math.round(Number(currentPrice) * 0.9)}
                  </button>
                )}
              </div>

              {/* DETAILED PRODUCT DESCRIPTION SECTION */}
              <div className="pt-6 border-t border-stone-200/80 space-y-3">
                <h3 className="font-serif font-black text-sm text-[#2A2A2A] uppercase tracking-wider">
                  Product Description
                </h3>
                <div className="text-sm text-[#6b6661] leading-relaxed space-y-3">
                  <p>
                    {product.storyDescription || product.description}
                  </p>
                  <p>
                    Every batch is lab-tested before dispatch so what reaches your kitchen is 100% pure, unadulterated, and crafted with uncompromised quality.
                  </p>
                </div>

                {/* Trust Badges Grid (Matching Reference Screenshot) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-stone-200/60">
                  <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-white border border-stone-200/60 shadow-2xs">
                    <Truck className="h-6 w-6 text-[#3A6038] mb-2" />
                    <span className="text-xs font-bold text-[#2A2A2A] mb-0.5">Free Shipping</span>
                    <span className="text-[10px] text-[#6b6661]">Orders Above ₹499</span>
                  </div>
                  <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-white border border-stone-200/60 shadow-2xs">
                    <Headphones className="h-6 w-6 text-[#3A6038] mb-2" />
                    <span className="text-xs font-bold text-[#2A2A2A] mb-0.5">360° Support</span>
                    <span className="text-[10px] text-[#6b6661]">Always Here to Help</span>
                  </div>
                  <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-white border border-stone-200/60 shadow-2xs">
                    <RotateCcw className="h-6 w-6 text-[#3A6038] mb-2" />
                    <span className="text-xs font-bold text-[#2A2A2A] mb-0.5">100% Purity</span>
                    <span className="text-[10px] text-[#6b6661]">Guaranteed Fresh</span>
                  </div>
                  <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-white border border-stone-200/60 shadow-2xs">
                    <ClipboardCheck className="h-6 w-6 text-[#3A6038] mb-2" />
                    <span className="text-xs font-bold text-[#2A2A2A] mb-0.5">70+ Checks</span>
                    <span className="text-[10px] text-[#6b6661]">Lab Tested Quality</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Tabs: Vedic Bilona Process / Details */}
          <div className="mt-16">
            <div className="flex border-b border-stone-200">
              {(['bilonaProcess', 'details'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-bold transition border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-[#3A6038] text-[#3A6038]'
                      : 'border-transparent text-[#6b6661] hover:text-[#2A2A2A]'
                  }`}
                >
                  {tab === 'bilonaProcess' ? 'Traditional Vedic Process' : 'Product Details'}
                </button>
              ))}
            </div>
            <div className="bg-white border border-t-0 border-stone-200 rounded-b-xl p-6">
              {activeTab === 'bilonaProcess' ? (
                <div className="max-w-4xl mx-auto space-y-8 py-2">
                  {/* Header Banner */}
                  <div className="bg-[#FAF8F3] border border-stone-200/80 rounded-2xl p-6 text-center space-y-2 shadow-2xs">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#3A6038] bg-[#3A6038]/10 px-3 py-1 rounded-full">
                      ⛰️ Himalayan Heritage & Craftsmanship
                    </span>
                    <h3 className="font-serif font-black text-2xl md:text-3xl text-[#2A2A2A]">
                      The 5-Step Traditional Vedic Bilona Process
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6b6661] max-w-2xl mx-auto leading-relaxed">
                      Handcrafted in Tanakpur, Uttarakhand using authentic curd-churning techniques. Unlike commercial cream-churned ghee, Vedic Bilona Ghee retains maximum natural aroma, A2 beta-casein purity, and granular Pahadi texture.
                    </p>
                  </div>

                  {/* 5 Steps Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-[#FAF8F3]/60 border border-stone-200/80 rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 shadow-2xs hover:border-[#3A6038] transition">
                      <div className="w-10 h-10 rounded-full bg-[#3A6038] text-amber-200 font-serif font-black text-lg flex items-center justify-center shadow-sm">
                        1
                      </div>
                      <h4 className="font-serif font-bold text-[#2A2A2A] text-sm">Free-Range Grazing</h4>
                      <p className="text-xs text-[#6b6661] leading-relaxed">
                        Native Desi cows graze freely in pesticide-free mountain pastures, drinking fresh Himalayan spring water.
                      </p>
                    </div>

                    <div className="bg-[#FAF8F3]/60 border border-stone-200/80 rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 shadow-2xs hover:border-[#3A6038] transition">
                      <div className="w-10 h-10 rounded-full bg-[#3A6038] text-amber-200 font-serif font-black text-lg flex items-center justify-center shadow-sm">
                        2
                      </div>
                      <h4 className="font-serif font-bold text-[#2A2A2A] text-sm">Whole Curd Culturing</h4>
                      <p className="text-xs text-[#6b6661] leading-relaxed">
                        Fresh A2 milk is boiled slowly in traditional vessels and naturally cultured into thick whole curd overnight.
                      </p>
                    </div>

                    <div className="bg-[#FAF8F3]/60 border border-stone-200/80 rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 shadow-2xs hover:border-[#3A6038] transition">
                      <div className="w-10 h-10 rounded-full bg-[#3A6038] text-amber-200 font-serif font-black text-lg flex items-center justify-center shadow-sm">
                        3
                      </div>
                      <h4 className="font-serif font-bold text-[#2A2A2A] text-sm">Wooden Bilona Churning</h4>
                      <p className="text-xs text-[#6b6661] leading-relaxed">
                        Curd is churned bi-directionally with a wooden bilona to gently separate pure Makhan (butter) from buttermilk.
                      </p>
                    </div>

                    <div className="bg-[#FAF8F3]/60 border border-stone-200/80 rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 shadow-2xs hover:border-[#3A6038] transition">
                      <div className="w-10 h-10 rounded-full bg-[#3A6038] text-amber-200 font-serif font-black text-lg flex items-center justify-center shadow-sm">
                        4
                      </div>
                      <h4 className="font-serif font-bold text-[#2A2A2A] text-sm">Slow Fire Simmering</h4>
                      <p className="text-xs text-[#6b6661] leading-relaxed">
                        Makhan is slowly simmered on low heat to yield golden liquid ghee with its signature granular (danedar) texture.
                      </p>
                    </div>

                    <div className="bg-[#FAF8F3]/60 border border-stone-200/80 rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 shadow-2xs hover:border-[#3A6038] transition">
                      <div className="w-10 h-10 rounded-full bg-[#3A6038] text-amber-200 font-serif font-black text-lg flex items-center justify-center shadow-sm">
                        5
                      </div>
                      <h4 className="font-serif font-bold text-[#2A2A2A] text-sm">Hand-Poured Purity</h4>
                      <p className="text-xs text-[#6b6661] leading-relaxed">
                        Strained through fine cloth and hand-poured into glass jars & traditional stainless-steel dolchis for dispatch.
                      </p>
                    </div>
                  </div>

                  {/* Purity Comparison Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl flex items-start gap-3">
                      <span className="text-xl">✨</span>
                      <div>
                        <h5 className="font-bold text-xs text-[#3A6038] uppercase tracking-wider mb-0.5">100% Curd Churned</h5>
                        <p className="text-xs text-[#6b6661] leading-relaxed">Never made from raw industrial cream. 25-30 litres of A2 milk yields just 1 litre of Bilona ghee.</p>
                      </div>
                    </div>
                    <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl flex items-start gap-3">
                      <span className="text-xl">🏺</span>
                      <div>
                        <h5 className="font-bold text-xs text-[#C59B27] uppercase tracking-wider mb-0.5">Rich Granular Aroma</h5>
                        <p className="text-xs text-[#6b6661] leading-relaxed">Natural golden colour, nutty Pahadi aroma, and bio-available nutrients intact.</p>
                      </div>
                    </div>
                    <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-xl flex items-start gap-3">
                      <span className="text-xl">🛡️</span>
                      <div>
                        <h5 className="font-bold text-xs text-[#2A2A2A] uppercase tracking-wider mb-0.5">Zero Additives</h5>
                        <p className="text-xs text-[#6b6661] leading-relaxed">No preservatives, synthetic colours, or chemical solvents. Certified 100% pure.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-[#6b6661]">
                  {Object.entries(dynamicDetails).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-stone-100 pb-2.5 items-center">
                      <span className="font-bold text-[#2A2A2A]">{key}</span>
                      <span className="font-medium text-[#2A2A2A]">{value as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reviews Section */}
          {ENABLE_PRODUCT_RATINGS && (
            <div className="mt-16">
              <h2 className="font-serif font-black text-2xl text-[#2A2A2A] mb-8">Customer Reviews</h2>
              <ReviewSummary
                averageRating={product.averageRating || 0}
                totalReviews={product.totalReviews || reviews.length}
              />

              {/* Write a Review (only if logged in) */}
              {user && token && (
                <div className="mt-8">
                  <ReviewForm productId={product.id} token={token} onSubmitted={fetchProduct} />
                </div>
              )}

              {/* Review List */}
              {reviews.length > 0 && (
                <div className="mt-8">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
              {reviews.length === 0 && (
                <p className="text-xs text-[#6b6661] mt-6">No reviews yet. Be the first to share your experience!</p>
              )}
            </div>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16">
              <h2 className="font-serif font-black text-2xl text-[#2A2A2A] mb-8">You May Also Like</h2>
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
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onCheckout={() => {}} />
    </div>
  );
}
