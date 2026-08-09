'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Search, User, Menu, X, Wallet, LogOut, Package, ChevronDown } from 'lucide-react';
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
  const { user, cart, walletBalance, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  return (
    <header className="sticky top-0 z-40">
      {/* Devbhoomi Uttarakhand Origin Top Bar */}
      <div className="bg-[#2d4d2b] text-stone-100 text-[11px] font-medium py-1.5 px-4 text-center tracking-wide flex items-center justify-center gap-2 border-b border-white/10">
        <span className="bg-[#C59B27] text-stone-950 font-extrabold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider shadow-2xs">
          ⛰️ Devbhoomi Origin
        </span>
        <span className="hidden sm:inline">Handcrafted in the Himalayan Foothills of Tanakpur, Uttarakhand</span>
        <span className="sm:hidden">Tanakpur, Uttarakhand</span>
        <span className="text-white/40">•</span>
        <span className="font-semibold text-amber-200">Free Shipping Orders ₹499+</span>
      </div>
      <nav className="bg-white/95 backdrop-blur-sm border-b border-stone-200">
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
            className="flex items-center space-x-2.5 group cursor-pointer"
          >
            <div className="relative h-14 w-auto flex items-center justify-center overflow-hidden">
              <Image
                src="/images/logo-icon.png"
                alt="Country Dairy Logo"
                width={200}
                height={70}
                className="h-14 w-auto object-contain"
                priority
              />
            </div>
          </Link>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex flex-none items-center justify-center space-x-8 text-sm font-semibold text-[#2A2A2A]">
          {navLink('home', 'Home', 'hover:text-[#3A6038] transition')}
          {navLink('shop', 'Shop', 'hover:text-[#3A6038] transition')}
          {navLink('about', 'About', 'hover:text-[#3A6038] transition')}
          {navLink('values', 'Farm', 'hover:text-[#3A6038] transition')}
          {navLink('contact', 'Contact', 'hover:text-[#3A6038] transition')}
        </div>

        {/* Right Side Actions */}
        <div className="flex-1 flex justify-end items-center space-x-3 md:space-x-4">
          {/* Search */}
          {ENABLE_CART && (
            <Link href="/products" className="hidden md:flex p-2 text-[#2A2A2A] hover:text-[#3A6038] transition" title="Search Products">
              <Search className="h-5 w-5" />
            </Link>
          )}

          {/* Auth / User */}
          {ENABLE_USER_ACCOUNTS && (
            user ? (
              <div className="flex items-center space-x-3">
                {/* Wallet badge */}
                <div className="hidden sm:flex items-center bg-[#FAF8F3] px-3 py-1.5 rounded-full border border-stone-200">
                  <Wallet className="h-4 w-4 text-[#C59B27] mr-1.5" />
                  <span className="text-xs font-bold text-[#3A6038]">₹{walletBalance}</span>
                </div>

                {/* User dropdown trigger */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1 p-2 text-[#2A2A2A] hover:text-[#3A6038] transition rounded-lg hover:bg-stone-50"
                    title={user.name || 'My Account'}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#3A6038] text-white flex items-center justify-center text-xs font-black">
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown menu */}
                  {userDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-stone-100">
                        <p className="text-sm font-bold text-[#2A2A2A] truncate">{user.name || 'Welcome!'}</p>
                        <p className="text-xs text-[#6b6661] truncate">{user.phone || user.email || ''}</p>
                      </div>

                      {/* Menu items */}
                      <div className="py-1">
                        <Link
                          href="/account"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#2A2A2A] hover:bg-[#FAF8F3] transition"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <User className="h-4 w-4 text-[#3A6038]" />
                          My Account
                        </Link>

                        <Link
                          href="/account"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#2A2A2A] hover:bg-[#FAF8F3] transition"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <Package className="h-4 w-4 text-[#3A6038]" />
                          My Orders
                        </Link>

                        {/* Mobile wallet (visible only on small screens that hide the inline badge) */}
                        <div className="sm:hidden flex items-center gap-3 px-4 py-2.5 text-sm text-[#2A2A2A]">
                          <Wallet className="h-4 w-4 text-[#C59B27]" />
                          Wallet: <span className="font-bold text-[#3A6038]">₹{walletBalance}</span>
                        </div>
                      </div>

                      {/* Logout */}
                      <div className="border-t border-stone-100 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left"
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
                className="p-2 text-[#2A2A2A] hover:text-[#3A6038] transition"
              >
                <User className="h-5 w-5" />
              </button>
            )
          )}

          {/* Cart */}
          {ENABLE_CART && (
            <button
              onClick={onCartOpen}
              className="relative p-2 text-[#2A2A2A] hover:text-[#3A6038] transition"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#C59B27] text-white text-[9px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center min-w-[18px] min-h-[18px] border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-[#2A2A2A]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-stone-100 px-4 py-4 space-y-3">
          {navLink('home', 'Home', 'block text-sm font-semibold text-[#2A2A2A]')}
          {navLink('shop', 'Shop', 'block text-sm font-semibold text-[#2A2A2A]')}
          {navLink('about', 'About', 'block text-sm font-semibold text-[#2A2A2A]')}
          {navLink('values', 'Farm', 'block text-sm font-semibold text-[#2A2A2A]')}
          {navLink('contact', 'Contact', 'block text-sm font-semibold text-[#2A2A2A]')}
          {ENABLE_USER_ACCOUNTS && (
            user ? (
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <Link href="/account" className="block text-sm font-bold text-[#3A6038]" onClick={() => setMobileMenuOpen(false)}>
                  My Account
                </Link>
                <button onClick={handleLogout} className="block text-sm font-bold text-red-600">
                  Sign Out
                </button>
              </div>
            ) : (
              <button onClick={() => { onAuthOpen(); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-bold text-[#3A6038]">
                Sign In
              </button>
            )
          )}
        </div>
      )}
      </nav>
    </header>
  );
}
