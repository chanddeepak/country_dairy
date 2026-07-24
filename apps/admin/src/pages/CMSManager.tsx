import { useState } from 'react';
import { Save } from 'lucide-react';
import FeatureFlagsPanel from './FeatureFlags';
import WhatsAppCMS from './WhatsAppCMS';
import CategoryCMS from './CategoryCMS';
import TrustBadgesCMS from './TrustBadgesCMS';

import type { CategoryItem } from './CategoryCMS';

interface CMSManagerProps {
  categories?: CategoryItem[];
  onUpdateCategories?: (categories: CategoryItem[]) => void;
}

export default function CMSManager({ categories = [], onUpdateCategories = () => {} }: CMSManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'announcement' | 'badges' | 'categories' | 'flags' | 'whatsapp'>('announcement');

  // Announcement Banner State
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [announcementText, setAnnouncementText] = useState('🎉 Free Shipping on orders above ₹499 | Direct Farm Fresh Delivery');
  const [bgColor, setBgColor] = useState('#065f46');
  const [textColor, setTextColor] = useState('#fef3c7');

  const handleSaveAnnouncement = () => {
    alert('Announcement Banner settings saved!');
  };

  return (
    <div className="space-y-6 text-stone-100">
      {/* Sub Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-stone-800 pb-2">
        <button
          onClick={() => setActiveSubTab('announcement')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'announcement'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          1. Announcement Banner
        </button>

        <button
          onClick={() => setActiveSubTab('badges')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'badges'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          2. Homepage Trust Cards
        </button>

        <button
          onClick={() => setActiveSubTab('categories')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'categories'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          3. Categories & Taxonomy
        </button>

        <button
          onClick={() => setActiveSubTab('whatsapp')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'whatsapp'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          4. WhatsApp Order Template
        </button>

        <button
          onClick={() => setActiveSubTab('flags')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'flags'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
          }`}
        >
          5. Feature Flags
        </button>
      </div>

      {/* ANNOUNCEMENT BANNER */}
      {activeSubTab === 'announcement' && (
        <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <h1 className="text-xl font-bold">Top Promotional Announcement Strip</h1>
              <p className="text-xs text-stone-400">Edit the top banner ribbon shown on storefront navbar.</p>
            </div>
            <button
              onClick={handleSaveAnnouncement}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md"
            >
              <Save className="h-4 w-4" /> Save Banner
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bannerCheck"
                checked={announcementEnabled}
                onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                className="accent-amber-500"
              />
              <label htmlFor="bannerCheck" className="font-bold text-stone-200">Enable Announcement Banner on Storefront</label>
            </div>

            <div>
              <label className="block font-bold text-stone-200 mb-1">Banner Text</label>
              <input
                type="text"
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-stone-200 mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-stone-300">{bgColor}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-200 mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-stone-300">{textColor}</span>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="pt-4 space-y-2">
              <div className="text-xs font-bold text-stone-400">Live Banner Preview:</div>
              <div
                className="py-2.5 px-4 text-center font-bold text-xs rounded-xl shadow transition-all"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                {announcementText || 'Banner text preview'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HOMEPAGE TRUST CARDS */}
      {activeSubTab === 'badges' && <TrustBadgesCMS />}

      {/* CATEGORIES & TAXONOMY */}
      {activeSubTab === 'categories' && <CategoryCMS categories={categories} onUpdateCategories={onUpdateCategories} />}

      {/* WHATSAPP TEMPLATE */}
      {activeSubTab === 'whatsapp' && <WhatsAppCMS />}

      {/* FEATURE FLAGS */}
      {activeSubTab === 'flags' && <FeatureFlagsPanel />}
    </div>
  );
}
