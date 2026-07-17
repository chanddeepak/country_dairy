'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer id="contact" className="bg-stone-900 text-stone-400 py-16 px-6 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4">Country Dairy</h4>
          <p className="text-xs leading-relaxed max-w-sm">
            Delivering certified pure organic products to families. Transparent quality audits published for every product batch.
          </p>
        </div>
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4 flex items-center">
            <ShieldCheck className="h-5 w-5 text-[#C59B27] mr-2" />
            NABL Audited
          </h4>
          <p className="text-xs leading-relaxed max-w-sm">
            All milk batches are screened for dilution, starch, detergents, and urea before release. Zero contamination.
          </p>
        </div>
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4">Support & Contacts</h4>
          <div className="text-xs leading-relaxed space-y-2">
            <p>📍 Country Dairy, Tanakpur, Champawat, Uttarakhand - 262309</p>
            <p>📧 Email: <a href="mailto:support@countrydairy.farm" className="text-[#C59B27] hover:underline">support@countrydairy.farm</a></p>
            <p>📞 Support Helpline: <strong>+91 82919 39317</strong></p>
            <p>💬 WhatsApp Orders: <a href="https://wa.me/918291939317" target="_blank" className="text-[#C59B27] hover:underline">+91 82919 39317</a></p>
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
