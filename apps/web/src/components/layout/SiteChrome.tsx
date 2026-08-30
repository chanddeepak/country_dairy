'use client';

import { useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import AuthModal from '../modals/AuthModal';
import CartDrawer from '../cart/CartDrawer';

/**
 * Nav, footer, cart and sign-in around a page that does not want to be a
 * client component.
 *
 * Navbar needs open/close handlers and Footer sits below the fold on every
 * page, which is why every route so far declared 'use client' just to hold two
 * booleans. The content pages must not do that: their whole value is being in
 * the HTML a crawler receives.
 *
 * `children` are rendered on the server and passed through — a client
 * component can hold server-rendered children, so the prose stays in the first
 * response while the chrome around it stays interactive.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />
      <main className="flex-1 bg-[var(--ivory)]">{children}</main>
      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
