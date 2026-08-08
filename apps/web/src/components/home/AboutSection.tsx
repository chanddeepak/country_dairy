'use client';

import React from 'react';
import { Leaf, Heart, Shield, Truck } from 'lucide-react';

const storyPoints = [
  {
    icon: <Leaf className="h-6 w-6" />,
    title: 'Himalayan Foothill Farm',
    description:
      'Country Dairy is located in Tanakpur, Champawat, Uttarakhand — where cows graze freely on lush green hill pastures in the lap of nature.',
  },
  {
    icon: <Heart className="h-6 w-6" />,
    title: 'Pure Spring Water & Pastures',
    description:
      'Our native Desi cows drink mountain spring water and feed on natural flora. Happy cows yield the highest quality A2 Bilona Ghee.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Quality & Purity Assured',
    description:
      'Batch-tested for fat purity, aroma, and zero adulterants to deliver authentic farm-fresh Vedic A2 Bilona Ghee.',
  },
  {
    icon: <Truck className="h-6 w-6" />,
    title: 'Fresh from Devbhoomi',
    description:
      'Directly shipped from our farm in Uttarakhand across India. Pure, unadulterated, and packaged with zero chemical preservatives.',
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24 py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-[#C59B27] font-bold text-xs uppercase tracking-[0.2em] mb-3">
            Our Story
          </p>
          <h2 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] mb-4">
            From Our Farm to Your Family
          </h2>
          <div className="w-16 h-0.5 bg-[#C59B27] mx-auto mb-6" />
          <p className="text-sm text-[#6b6661] leading-relaxed">
            We are a small team of farmers, dairy scientists, and delivery riders on a mission to
            bring genuinely pure, organic dairy products to families who care about what they consume.
            No middlemen, no additives — just honest food.
          </p>
        </div>

        {/* Story points grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {storyPoints.map((point) => (
            <div
              key={point.title}
              className="group text-center p-6 rounded-2xl border border-transparent hover:border-stone-200 hover:shadow-sm transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-[#3A6038]/10 text-[#3A6038] flex items-center justify-center group-hover:bg-[#3A6038] group-hover:text-white transition-colors duration-300">
                {point.icon}
              </div>
              <h4 className="font-bold text-sm text-[#2A2A2A] mb-2">{point.title}</h4>
              <p className="text-xs text-[#6b6661] leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
