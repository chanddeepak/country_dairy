'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ContourField from '../ui/ContourField';
import ContactForm from '../ContactForm';

/**
 * The foot of every page.
 *
 * Forest rather than the near-black it was, so it closes the page in the brand's
 * own colour instead of a neutral that belongs to no one. The contour runs
 * underneath it, which is the last place the signature appears on a page.
 *
 * The contact form, the WhatsApp number and the id="contact" anchor are load
 * bearing: the header links to that anchor and the support tests post through
 * that form.
 */
export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative bg-[var(--forest)] text-[var(--sand)] pt-20 pb-10 px-6 mt-auto overflow-hidden"
    >
      <ContourField tone="brass" opacity={0.45} />

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <Image
            src="/images/logo-ivory.png"
            alt="Country Dairy"
            width={400}
            height={260}
            className="h-12 w-auto object-contain mb-5"
          />
          <p className="text-[13px] leading-relaxed max-w-xs text-[rgb(var(--sand-rgb)/0.75)] font-light">
            From the heart of Devbhoomi, to your home. Handcrafted in the Himalayan
            foothills of Tanakpur, Uttarakhand, with a batch report for everything
            we make.
          </p>
        </div>

        <div>
          <p className="mb-5 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-on-dark)]">Shop</p>
          <ul className="grid gap-2.5 text-[13px] font-light">
            <li><Link href="/products" className="hover:text-white transition-colors">All products</Link></li>
            <li><Link href="/category/ghee" className="hover:text-white transition-colors">Ghee</Link></li>
            <li><Link href="/products" className="hover:text-white transition-colors">Collections</Link></li>
            <li><a href="https://wa.me/919997801112" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Order on WhatsApp</a></li>
          </ul>
        </div>

        <div>
          <p className="mb-5 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-on-dark)]">Support and contact</p>
          <div className="text-[13px] leading-relaxed grid gap-2 font-light">
            <p className="m-0">Country Dairy, Tanakpur, Champawat, Uttarakhand 262309</p>
            <p className="m-0">
              <a href="mailto:info@countrydairy.in" className="hover:text-white transition-colors">info@countrydairy.in</a>
            </p>
            <p className="m-0">Helpline <span className="text-[var(--ivory)]">+91 99978 01112</span></p>
            <p className="m-0">
              WhatsApp orders{' '}
              <a href="https://wa.me/919997801112" target="_blank" rel="noreferrer" className="text-[var(--brass-on-dark)] hover:text-white transition-colors">
                +91 99978 01112
              </a>
            </p>
            <p className="m-0 text-[var(--ivory)]">Delivery across India</p>
            <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-[rgb(var(--sand-rgb)/0.55)] pt-1">
              Daily 6:00 AM to 9:00 PM
            </p>
          </div>
        </div>

        <div>
          <p className="mb-5 text-[10px] uppercase tracking-[0.22em] text-[var(--brass-on-dark)]">Ask us anything</p>
          <p className="text-[13px] leading-relaxed mb-4 text-[rgb(var(--sand-rgb)/0.75)] font-light">
            No account needed. We read every message and reply by email.
          </p>
          <ContactForm />
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto mt-14 pt-7 border-t border-white/12 flex flex-wrap justify-between gap-4 text-[12px] text-[rgb(var(--sand-rgb)/0.6)] font-light">
        <p className="m-0">&copy; 2026 Country Dairy</p>

        {/* The policy pages live here rather than in a column of their own:
            they are looked for at the foot of a page, and a payment gateway
            checking a merchant site looks in exactly this spot. */}
        <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link href="/shipping-and-returns" className="hover:text-white transition-colors">Shipping &amp; Returns</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        </nav>

        <p className="m-0">Every batch tested. Every jar traceable.</p>
      </div>
    </footer>
  );
}
