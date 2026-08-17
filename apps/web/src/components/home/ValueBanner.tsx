'use client';

import React from 'react';
import Link from 'next/link';

// Value proposition cards matching "Why Country Dairy" section
const values = [
  {
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" stroke="#3A6038" strokeWidth="1.5">
        <path d="M24 4c-4 8-12 14-12 24a12 12 0 0 0 24 0C36 18 28 12 24 4z" />
        <path d="M24 14c-2 4-6 8-6 14a6 6 0 0 0 12 0c0-6-4-10-6-14z" />
      </svg>
    ),
    title: '100% Organic & Pure',
    description: 'Curd-churned A2 Bilona Ghee made with zero chemical solvents, synthetic preservatives, or artificial additives.',
    href: '#about',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" stroke="#3A6038" strokeWidth="1.5">
        <circle cx="24" cy="24" r="16" />
        <text x="24" y="28" textAnchor="middle" fill="#3A6038" fontSize="14" fontWeight="bold" stroke="none">A2</text>
      </svg>
    ),
    title: 'A2 Beta-Casein',
    description: 'Rich in A2 protein from free-grazing native Desi cows, making it gentle on digestion and highly nutritious.',
    href: '#about',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" stroke="#3A6038" strokeWidth="1.5">
        <path d="M8 36c4-4 8-12 16-12s12 8 16 12" />
        <path d="M20 24c-2-6 0-12 4-16 4 4 6 10 4 16" />
        <line x1="24" y1="8" x2="24" y2="24" />
      </svg>
    ),
    title: 'Mountain Grass-Fed',
    description: 'Cows graze freely on wild Himalayan hill flora and drink pure mountain spring water in Tanakpur, Uttarakhand.',
    href: '#about',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" stroke="#3A6038" strokeWidth="1.5">
        <circle cx="24" cy="24" r="16" />
        <path d="M14 24h20M24 14v20M18 18l12 12M30 18L18 30" strokeWidth="1" />
      </svg>
    ),
    title: 'Eco-Friendly & Sustainable',
    description: 'Hand-poured into recyclable glass jars and traditional food-grade metal dolchis for farm-fresh delivery across India.',
    href: '#about',
  },
];

export default function ValueBanner() {
  const handleScrollToAbout = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const el = document.getElementById(href.replace('#', ''));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section id="values" className="py-16 px-4 sm:px-6 lg:px-8 bg-[#FAF8F3]">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] text-center mb-12">
          Why Country Dairy
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {values.map((value) => (
            <div
              key={value.title}
              className="bg-white border border-stone-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-center mb-4">
                  {value.icon}
                </div>
                <h4 className="font-bold text-sm text-[#2A2A2A] mb-2">{value.title}</h4>
                <p className="text-xs text-[#6b6661] leading-relaxed">{value.description}</p>
              </div>
              <div className="pt-4">
                <Link
                  href={value.href}
                  onClick={(e) => handleScrollToAbout(e, value.href)}
                  className="inline-block bg-[#C59B27] hover:bg-[#b08b22] text-white text-xs font-bold px-4 py-2 rounded-sm uppercase tracking-wider transition shadow-2xs"
                >
                  Learn More
                </Link>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-100 inline-block px-4 py-2 rounded-full">
            🇮🇳 We currently deliver across India only
          </p>
        </div>
      </div>
    </section>
  );
}
