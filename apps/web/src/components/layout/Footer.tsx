'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="contact" className="bg-stone-900 text-stone-400 py-16 px-6 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <svg viewBox="0 0 60 44" className="w-10 h-8 text-[#C59B27]" fill="none">
              <path d="M5 26L16 13L25 21L34 8L43 18L55 26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M34 8L37.5 15M16 13L19 18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <path d="M22 23C21 23 20.5 24 20.5 25.5V33H22V29H31V33H32.5V28.5L34.5 27.5C36 26.5 37 25 38 25.5C38.5 25.8 39 25 38.5 24.2C38 23.5 36.5 23 35 23.5L32.5 24.5C31.5 23.5 30 23 28 23H22Z" fill="currentColor" />
              <path d="M8 36Q30 40 52 36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div>
              <h4 className="text-white font-serif font-black text-xl leading-tight">Country Dairy</h4>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#C59B27] block">Devbhoomi Uttarakhand</span>
            </div>
          </div>
          <p className="text-xs leading-relaxed max-w-sm text-stone-400">
            Handcrafting certified pure organic products in the Himalayan foothills of Tanakpur, Uttarakhand. Transparent quality audits for every product batch.
          </p>
        </div>
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4 flex items-center">
            <ShieldCheck className="h-5 w-5 text-[#C59B27] mr-2" />
            NABL Audited
          </h4>
          <p className="text-xs leading-relaxed max-w-sm">
            All product batches are screened for adulterants and quality metrics before release. Zero contamination.
          </p>
        </div>
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4">Support & Contacts</h4>
          <div className="text-xs leading-relaxed space-y-2">
            <p>📍 Country Dairy, Tanakpur, Champawat, Uttarakhand - 262309</p>
            <p>📧 Email: <a href="mailto:info@countrydairy.in" className="text-[#C59B27] hover:underline">info@countrydairy.in</a></p>
            <p>📞 Support Helpline: <strong>+91 99978 01112</strong></p>
            <p>💬 WhatsApp Orders: <a href="https://wa.me/919997801112" target="_blank" className="text-[#C59B27] hover:underline">+91 99978 01112</a></p>
            <p>📦 <span className="font-bold">Delivery available across India</span></p>
            <p className="text-stone-500 font-medium text-[10px] uppercase pt-1">Service Hours: Daily 6:00 AM – 9:00 PM</p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-stone-800 text-center">
        <p className="text-xs text-stone-500">© 2026 Country Dairy. All rights reserved.</p>
      </div>
    </footer>
  );
}
