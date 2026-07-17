'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Minus, Plus, Calendar, ShoppingBag, MessageCircle } from 'lucide-react';
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
import { FALLBACK_PRODUCTS, API_URL, PRODUCT_IMAGES, ENABLE_SUBSCRIPTIONS, ENABLE_WEBSITE_PAYMENT, WHATSAPP_NUMBER, WHATSAPP_MESSAGE_TEMPLATE, ENABLE_PRODUCT_RATINGS } from '../../../lib/constants';

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, token, addToCart } = useApp();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'nutrition' | 'details'>('nutrition');
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  // Modal state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubscrOpen, setIsSubscrOpen] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchProduct();
      fetchReviews();
    }
  }, [slug]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`${API_URL}/catalog/products/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data);
        // Fetch all products for "related" section
        const allRes = await fetch(`${API_URL}/catalog/products`);
        const all = await allRes.json();
        setRelatedProducts((Array.isArray(all) ? all : FALLBACK_PRODUCTS).filter((p: any) => p.slug !== slug).slice(0, 3));
      } else {
        // Fallback to local data
        const fb = FALLBACK_PRODUCTS.find((p) => p.slug === slug) || FALLBACK_PRODUCTS[0];
        setProduct(fb);
        setRelatedProducts(FALLBACK_PRODUCTS.filter((p) => p.slug !== slug).slice(0, 3));
      }
    } catch {
      const fb = FALLBACK_PRODUCTS.find((p) => p.slug === slug) || FALLBACK_PRODUCTS[0];
      setProduct(fb);
      setRelatedProducts(FALLBACK_PRODUCTS.filter((p) => p.slug !== slug).slice(0, 3));
    }
  };

  const fetchReviews = async () => {
    try {
      // We need productId but don't have it from slug yet; fetch after product loads
    } catch { /* noop */ }
  };

  useEffect(() => {
    if (product?.id) {
      fetch(`${API_URL}/products/${product.id}/reviews`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setReviews(Array.isArray(data) ? data : []))
        .catch(() => setReviews([]));
    }
  }, [product?.id]);

  if (!product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-[#6b6661]">Loading product...</div>
        </div>
        <Footer />
      </div>
    );
  }

  const imageSrc = PRODUCT_IMAGES[product.slug] || product.imageUrls?.[0] || '/images/products/milk-bottle.png';
  const nutrition = product.nutritionFacts || {};
  const metadata = product.metadata || {};

  const handleAddToCart = () => {
    if (!user) { setIsAuthOpen(true); return; }
    addToCart(product.id, quantity);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[#FAF8F3]">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center text-xs text-[#6b6661] gap-1">
            <Link href="/" className="hover:text-[#3A6038] transition">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/products" className="hover:text-[#3A6038] transition">Shop</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[#2A2A2A] font-bold">{product.name}</span>
          </nav>
        </div>

        {/* Product Main Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Left: Image */}
            <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-stone-200">
              <Image
                src={imageSrc}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>

            {/* Right: Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#3A6038] bg-[#3A6038]/10 px-2 py-0.5 rounded-full">
                    {product.category?.name || 'Dairy'}
                  </span>
                  <span className="text-xs text-[#6b6661]">•</span>
                  <span className="text-xs text-[#6b6661]">{metadata.packaging || 'Glass Bottle'}</span>
                </div>
                <h1 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] leading-tight">{product.name}</h1>
              </div>

              {ENABLE_PRODUCT_RATINGS && (
                <div className="flex items-center gap-2">
                  <StarRating rating={product.averageRating || 0} size="md" />
                  <span className="text-sm font-bold text-[#2A2A2A]">{(product.averageRating || 0).toFixed(1)}</span>
                  <span className="text-xs text-[#6b6661]">({product.totalReviews || reviews.length} reviews)</span>
                </div>
              )}

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-[#2A2A2A]">₹{product.price}</span>
                <span className="text-sm text-[#6b6661]">per {metadata.volume || metadata.weight || 'unit'}</span>
              </div>

              <p className="text-sm text-[#6b6661] leading-relaxed">{product.description}</p>

              {/* Quantity Selector */}
              <div>
                <span className="text-xs font-bold text-[#2A2A2A] block mb-2">QUANTITY:</span>
                <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg w-fit px-3 py-1.5">
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
              <div className="space-y-3 pt-2">
                {ENABLE_WEBSITE_PAYMENT && (
                  <button
                    onClick={handleAddToCart}
                    className="w-full flex items-center justify-center bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold py-3.5 rounded-lg text-sm uppercase tracking-wider transition shadow-md hover:shadow-lg"
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Add to Cart — ₹{Number(product.price) * quantity}
                  </button>
                )}
                
                {!ENABLE_WEBSITE_PAYMENT && (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi! I'd like to order:\n- ${quantity} x ${product.name} (₹${product.price} each)\nTotal: ₹${Number(product.price) * quantity}\n\nPlease help me place this order. Thank you!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-lg text-sm uppercase tracking-wider transition shadow-md hover:shadow-lg"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Order on WhatsApp — ₹{Number(product.price) * quantity}
                  </a>
                )}
                
                {ENABLE_SUBSCRIPTIONS && product.isSubscriptionAllowed && (
                  <button
                    onClick={() => {
                      if (!user) { setIsAuthOpen(true); return; }
                      setIsSubscrOpen(true);
                    }}
                    className="w-full flex items-center justify-center border-2 border-[#3A6038] text-[#3A6038] hover:bg-[#3A6038]/5 font-bold py-3 rounded-lg text-sm uppercase tracking-wider transition"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Subscribe Daily — ₹{Math.round(Number(product.price) * 0.9)}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs: Nutrition / Details */}
          <div className="mt-16">
            <div className="flex border-b border-stone-200">
              {(['nutrition', 'details'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-bold transition border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-[#3A6038] text-[#3A6038]'
                      : 'border-transparent text-[#6b6661] hover:text-[#2A2A2A]'
                  }`}
                >
                  {tab === 'nutrition' ? 'Nutrition Facts' : 'Details'}
                </button>
              ))}
            </div>
            <div className="bg-white border border-t-0 border-stone-200 rounded-b-xl p-6">
              {activeTab === 'nutrition' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(nutrition).map(([key, value]) => (
                    <div key={key} className="text-center p-4 bg-[#FAF8F3] rounded-lg">
                      <span className="text-xs font-bold text-[#6b6661] uppercase tracking-wider block mb-1">{key}</span>
                      <span className="text-lg font-black text-[#2A2A2A]">{value as string}</span>
                    </div>
                  ))}
                  {metadata.shelfLife && (
                    <div className="text-center p-4 bg-[#FAF8F3] rounded-lg">
                      <span className="text-xs font-bold text-[#6b6661] uppercase tracking-wider block mb-1">Shelf Life</span>
                      <span className="text-lg font-black text-[#2A2A2A]">{metadata.shelfLife}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-sm text-[#6b6661]">
                  {Object.entries(metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-stone-100 pb-2">
                      <span className="font-bold text-[#2A2A2A] capitalize">{key}</span>
                      <span>{value as string}</span>
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
