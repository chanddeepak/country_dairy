'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import HeroSection from '../components/home/HeroSection';
import BrandStatement from '../components/home/BrandStatement';
import Devbhoomi from '../components/home/Devbhoomi';
import Journey from '../components/home/Journey';
import Rituals from '../components/home/Rituals';
import Reviews from '../components/home/Reviews';
import ClosingBand from '../components/home/ClosingBand';
import ProductShelf from '../components/home/ProductShelf';
import GheeStory from '../components/home/GheeStory';
import Principles from '../components/home/Principles';
import AuthModal from '../components/modals/AuthModal';
import SubscriptionModal from '../components/modals/SubscriptionModal';
import CartDrawer from '../components/cart/CartDrawer';

export default function Home() {
  const router = useRouter();
  const { user } = useApp();

  // Modal / drawer state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubscrOpen, setIsSubscrOpen] = useState(false);
  const [subscrProduct, setSubscrProduct] = useState<any>(null);

  const handleSubscribe = (product: any) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setSubscrProduct(product);
    setIsSubscrOpen(true);
  };

  /*
   * No sign-in gate. Every other page has always been a plain push to
   * /checkout; this one alone demanded an account first, which is why checkout
   * still opened our login modal from the home page long after the checkout
   * page itself had stopped asking. Cashfree collects and verifies the mobile
   * number during payment, and the account is created from it afterwards.
   */
  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push('/checkout');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar
        onCartOpen={() => setIsCartOpen(true)}
        onAuthOpen={() => setIsAuthOpen(true)}
      />

      <main className="flex-1">
        <HeroSection />
        <BrandStatement />
        <ProductShelf onSubscribe={handleSubscribe} />
        <GheeStory />
        <Principles />
        <Devbhoomi />
        <Journey />
        <Rituals />
        <Reviews onAuthOpen={() => setIsAuthOpen(true)} />
        <ClosingBand />
      </main>

      <Footer />

      {/* Modals & Drawers */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SubscriptionModal
        isOpen={isSubscrOpen}
        onClose={() => { setIsSubscrOpen(false); setSubscrProduct(null); }}
        product={subscrProduct}
      />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
