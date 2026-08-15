'use client';

import React from 'react';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import ContactForm from '../ContactForm';

export default function Footer() {
  return (
    <footer id="contact" className="bg-stone-900 text-stone-400 py-16 px-6 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center p-1.5 bg-white rounded-xl overflow-hidden shadow-sm">
              <Image
                src="/images/logo-icon.png"
                alt="Country Dairy Logo"
                width={160}
                height={55}
                className="h-12 w-auto object-contain"
              />
            </div>
          </div>
          <p className="text-xs leading-relaxed max-w-sm text-stone-400">
            Handcrafting certified pure organic products in the Himalayan foothills of Tanakpur, Uttarakhand. Transparent quality audits for every product batch.
          </p>
        </div>
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4 flex items-center">
            <ShieldCheck className="h-5 w-5 text-[#C59B27] mr-2" />
            Quality Assured
          </h4>
          <p className="text-xs leading-relaxed max-w-sm">
            All product batches are screened for adulterants and quality metrics before release. Zero contamination.
          </p>
        </div>
        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4">Support &amp; Contacts</h4>
          <div className="text-xs leading-relaxed space-y-2">
            <p>📍 Country Dairy, Tanakpur, Champawat, Uttarakhand - 262309</p>
            <p>📧 Email: <a href="mailto:info@countrydairy.in" className="text-[#C59B27] hover:underline">info@countrydairy.in</a></p>
            <p>📞 Support Helpline: <strong>+91 99978 01112</strong></p>
            <p>💬 WhatsApp Orders: <a href="https://wa.me/919997801112" target="_blank" className="text-[#C59B27] hover:underline">+91 99978 01112</a></p>
            <p>📦 <span className="font-bold">Delivery available across India</span></p>
            <p className="text-stone-500 font-medium text-[10px] uppercase pt-1">Service Hours: Daily 6:00 AM – 9:00 PM</p>
          </div>
        </div>

        <div>
          <h4 className="text-white font-serif font-black text-xl mb-4">Ask us anything</h4>
          <p className="text-xs leading-relaxed mb-3 text-stone-400">
            No account needed. We read every message and reply by email.
          </p>
          <ContactForm />
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-stone-800 text-center">
        <p className="text-xs text-stone-500">© 2026 Country Dairy. All rights reserved.</p>
      </div>
    </footer>
  );
}
