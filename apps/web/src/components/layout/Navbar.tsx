'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Search, User, Menu, X, Wallet, LogOut, Package, ChevronDown } from 'lucide-react';
import CategoryBar from './CategoryBar';
import ContourField from '../ui/ContourField';
import { useNavTree } from '../../lib/useNavTree';
import { categoryIcon } from '../../lib/categoryIcon';
import { useApp } from '../../context/AppContext';
import { useStoreConfig } from '../../context/StoreConfigContext';

interface NavbarProps {
  onCartOpen: () => void;
  onAuthOpen: () => void;
}

export default function Navbar({ onCartOpen, onAuthOpen }: NavbarProps) {
  const { isFlagOn } = useStoreConfig();
  const ENABLE_CART = isFlagOn('ENABLE_CART');
  const ENABLE_USER_ACCOUNTS = isFlagOn('ENABLE_USER_ACCOUNTS');
  const walletEnabled = isFlagOn('ENABLE_WALLET');
  const { user, cart, walletBalance, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { tree: navTree } = useNavTree();

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * The bar goes transparent only while it is genuinely sitting on top of a
   * dark, full bleed hero, and is solid the rest of the time.
   *
   * Two conditions, and both matter. The page has to declare that it puts
   * artwork behind the header, by rendering an element carrying
   * data-hero-behind-nav; and the reader has to still be at the top of it.
   *
   * Assuming the homepage always qualifies is what the first version did, and
   * it painted white links onto the ivory ground because the current hero
   * starts below the header rather than behind it. A page says whether the
   * treatment applies; the bar does not guess.
   *
   * Position is tracked with a sentinel that scrolls out of view rather than a
   * scroll listener: the header is sticky so it never moves, and a listener
   * would run on every frame to answer a question that changes twice.
   */
  const [atTop, setAtTop] = useState(true);
  const [heroBehind, setHeroBehind] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setAtTop(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setHeroBehind(Boolean(document.querySelector('[data-hero-behind-nav]')));
  }, [pathname]);

  const overHero = heroBehind && atTop;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // A full screen menu must not leave the page scrolling behind it.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  // Navigation link generator with clean route/hash handling
  const navLink = (target: string, label: string, className: string) => {
    // For "Home" link
    if (target === 'home') {
      return (
        <Link
          href="/"
          className={className}
          onClick={(e) => {
            setMobileMenuOpen(false);
            if (pathname === '/') {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          {label}
        </Link>
      );
    }

    // For "Shop" link
    if (target === 'shop') {
      if (pathname === '/') {
        return (
          <a href="#shop" className={className} onClick={() => setMobileMenuOpen(false)}>
            {label}
          </a>
        );
      }
      return (
        <Link href="/products" className={className} onClick={() => setMobileMenuOpen(false)}>
          {label}
        </Link>
      );
    }

    // For section hash links (about, values, contact)
    if (pathname === '/') {
      return (
        <a href={`#${target}`} className={className} onClick={() => setMobileMenuOpen(false)}>
          {label}
        </a>
      );
    }
    return (
      <Link href={`/#${target}`} className={className} onClick={() => setMobileMenuOpen(false)}>
        {label}
      </Link>
    );
  };

  const handleLogout = () => {
    setUserDropdownOpen(false);
    logout();
  };

  // The tone is inherited by the row; the hover has to sit on each link. With
  // hover: on the container, pointing anywhere in the bar lit all five links at
  // once, and they stayed lit as long as the cursor was up there.
  const linkTone = overHero ? 'text-white/90' : 'text-[var(--ink)]';
  const linkHover = overHero ? 'hover:text-white' : 'hover:text-[var(--brass)]';
  const iconTone = overHero
    ? 'text-white/90 hover:text-white'
    : 'text-[var(--ink)] hover:text-[var(--brass)]';

  return (
    <>
      {/* Scrolls out of view, which is how the bar knows it is no longer at the top. */}
      <div ref={sentinelRef} aria-hidden="true" className="absolute top-0 h-px w-full" />

      <header className="sticky top-0 z-40">
        {/* Devbhoomi Uttarakhand Origin Top Bar */}
        <div className="bg-[var(--forest)] text-[var(--sand)] text-[11px] font-medium py-2 px-4 text-center tracking-[0.04em] flex items-center justify-center gap-2.5">
          <span className="bg-[var(--brass)] text-[#1a1405] font-semibold px-2.5 py-0.5 rounded-sm text-[9px] uppercase tracking-[0.14em]">
            Devbhoomi Origin
          </span>
          <span className="hidden sm:inline">Handcrafted in the Himalayan Foothills of Tanakpur, Uttarakhand</span>
          <span className="sm:hidden">Tanakpur, Uttarakhand</span>
          <span className="text-[var(--sand)]/40">&middot;</span>
          <span className="text-[var(--brass)]">Free shipping over &#8377;499</span>
        </div>

        <nav
          className={`transition-colors duration-500 ${
            overHero
              ? 'bg-transparent border-b border-white/15'
              : 'bg-[var(--ivory)]/95 backdrop-blur-sm border-b border-[var(--line)]'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
            {/* Logo */}
            <div className="flex-1 flex justify-start">
              <Link
                href="/"
                onClick={(e) => {
                  if (pathname === '/') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="flex items-center group cursor-pointer"
                aria-label="Country Dairy, home"
              >
                {/*
                 * Two files, not one with a filter. The supplied artwork is a
                 * green wordmark on solid white with no alpha, so on the
                 * transparent bar it would render as a white rectangle. Both
                 * variants are keyed from that same original.
                 */}
                <Image
                  src={overHero ? '/images/logo-ivory.png' : '/images/logo-forest.png'}
                  alt="Country Dairy"
                  width={400}
                  height={260}
                  className="h-12 w-auto object-contain transition-opacity duration-500"
                  priority
                />
              </Link>
            </div>

            {/* Desktop Nav Links */}
            <div className={`hidden md:flex flex-none items-center justify-center gap-9 text-[13px] tracking-[0.06em] ${linkTone}`}>
              {navLink('home', 'Home', `transition-colors ${linkHover}`)}
              {navLink('shop', 'Shop', `transition-colors ${linkHover}`)}
              {navLink('about', 'Our Story', `transition-colors ${linkHover}`)}
              {navLink('values', 'From the Hills', `transition-colors ${linkHover}`)}
              {navLink('contact', 'Contact', `transition-colors ${linkHover}`)}
            </div>

            {/* Right Side Actions */}
            <div className="flex-1 flex justify-end items-center gap-2 md:gap-3">
              {/* Search */}
              {ENABLE_CART && (
                <Link href="/products" className={`hidden md:flex p-2 transition-colors ${iconTone}`} title="Search Products">
                  <Search className="h-[18px] w-[18px]" />
                </Link>
              )}

              {/* Auth / User */}
              {ENABLE_USER_ACCOUNTS && (
                user ? (
                  <div className="flex items-center gap-2">
                    {/* Wallet badge — only when the wallet feature is enabled. */}
                    {walletEnabled && (
                      <div className={`hidden sm:flex items-center px-3 py-1.5 rounded-sm border text-xs ${
                        overHero ? 'border-white/25 text-white' : 'border-[var(--line)] text-[var(--forest)]'
                      }`}>
                        <Wallet className="h-3.5 w-3.5 text-[var(--brass)] mr-1.5" />
                        <span className="font-medium tabular">&#8377;{walletBalance}</span>
                      </div>
                    )}

                    {/* User dropdown trigger */}
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className={`flex items-center gap-1 p-1.5 transition-colors ${iconTone}`}
                        title={user.name || 'My Account'}
                      >
                        <span className="w-8 h-8 rounded-full bg-[var(--forest)] text-[var(--ivory)] flex items-center justify-center text-xs font-medium">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown menu */}
                      {userDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--ivory)] rounded-sm shadow-xl border border-[var(--line)] py-2 z-50">
                          {/* User info header */}
                          <div className="px-4 py-3 border-b border-[var(--line)]">
                            <p className="text-sm font-medium text-[var(--ink)] truncate">{user.name || 'Welcome'}</p>
                            <p className="text-xs text-[var(--ink-soft)] truncate">{user.phone || user.email || ''}</p>
                          </div>

                          {/* Menu items */}
                          <div className="py-1">
                            <Link
                              href="/account"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cream)] transition"
                              onClick={() => setUserDropdownOpen(false)}
                            >
                              <User className="h-4 w-4 text-[var(--forest)]" />
                              My Account
                            </Link>

                            <Link
                              href="/account?tab=orders"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--cream)] transition"
                              onClick={() => setUserDropdownOpen(false)}
                            >
                              <Package className="h-4 w-4 text-[var(--forest)]" />
                              My Orders
                            </Link>

                            {/* Mobile wallet (small screens hide the inline badge) */}
                            {walletEnabled && (
                              <div className="sm:hidden flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--ink)]">
                                <Wallet className="h-4 w-4 text-[var(--brass)]" />
                                Wallet: <span className="font-medium tabular">&#8377;{walletBalance}</span>
                              </div>
                            )}
                          </div>

                          {/* Logout */}
                          <div className="border-t border-[var(--line)] pt-1">
                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--terra)] hover:bg-[var(--cream)] transition w-full text-left"
                            >
                              <LogOut className="h-4 w-4" />
                              Sign Out
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onAuthOpen}
                    data-testid="open-auth"
                    aria-label="Sign in"
                    className={`p-2 transition-colors ${iconTone}`}
                  >
                    <User className="h-[18px] w-[18px]" />
                  </button>
                )
              )}

              {/* Cart */}
              {ENABLE_CART && (
                <button
                  onClick={onCartOpen}
                  data-testid="open-cart"
                  aria-label="Open cart"
                  className={`relative p-2 transition-colors ${iconTone}`}
                >
                  <ShoppingBag className="h-[18px] w-[18px]" />
                  {cartCount > 0 && (
                    <span
                      data-testid="cart-count"
                      className="absolute -top-0.5 -right-0.5 bg-[var(--brass)] text-[#1a1405] text-[10px] font-semibold h-4 min-w-4 px-1 rounded-full flex items-center justify-center"
                    >
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              {/* Mobile menu toggle */}
              <button
                className={`md:hidden p-2 transition-colors ${iconTone}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-toggle"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </nav>

        {/* The category bar, below the main nav and inside the sticky header. */}
        <CategoryBar />
      </header>

      {/*
       * Full screen on a phone rather than a dropdown panel. The brief asks for
       * it, and it is the only way the categories get room to be tapped rather
       * than aimed at.
       */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[var(--forest)] text-[var(--ivory)] overflow-y-auto">
          <ContourField tone="brass" opacity={0.5} />

          <div className="relative z-10 flex flex-col min-h-full px-6 py-5">
            <div className="flex items-center justify-between mb-10">
              <Image src="/images/logo-ivory.png" alt="Country Dairy" width={400} height={260} className="h-11 w-auto object-contain" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 text-[var(--sand)] hover:text-white transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 font-serif text-[30px] leading-tight">
              {navLink('home', 'Home', 'py-2 transition-colors hover:text-[var(--brass)]')}
              {navLink('shop', 'Shop', 'py-2 transition-colors hover:text-[var(--brass)]')}
              {navLink('about', 'Our Story', 'py-2 transition-colors hover:text-[var(--brass)]')}
              {navLink('values', 'From the Hills', 'py-2 transition-colors hover:text-[var(--brass)]')}
              {navLink('contact', 'Contact', 'py-2 transition-colors hover:text-[var(--brass)]')}
            </nav>

            {navTree.length > 0 && (
              <div className="mt-10 pt-8 border-t border-white/15">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--brass)] mb-4">
                  Shop by category
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {navTree.map((cat) => {
                    const Icon = categoryIcon(cat.iconName);
                    return (
                      <Link
                        key={cat.id}
                        href={`/category/${cat.slug}`}
                        data-testid="mobile-category-link"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-sm border border-white/15 px-4 py-3.5 transition hover:border-[var(--brass)]"
                      >
                        <Icon className="h-4 w-4 text-[var(--brass)]" strokeWidth={1.5} />
                        <span className="text-[13px] tracking-[0.03em]">{cat.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto pt-10 text-[12px] text-[var(--sand)]/70 leading-relaxed">
              <p className="m-0">Tanakpur, Champawat, Uttarakhand</p>
              <p className="m-0">From the heart of Devbhoomi, to your home.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
