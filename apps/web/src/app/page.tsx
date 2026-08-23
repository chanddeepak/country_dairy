'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import HeroSection from '../components/home/HeroSection';
import BrandStatement from '../components/home/BrandStatement';
import AboutSection from '../components/home/AboutSection';
import ProductShelf from '../components/home/ProductShelf';
import GheeStory from '../components/home/GheeStory';
import CollectionRow from '../components/home/CollectionRow';
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

  const handleCheckout = () => {
    if (!user) {
      setIsCartOpen(false);
      setIsAuthOpen(true);
      return;
    }
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
        <CollectionRow />
        <ProductShelf onSubscribe={handleSubscribe} />
        <GheeStory />
        <Principles />
        <AboutSection />
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
