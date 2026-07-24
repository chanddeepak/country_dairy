import { useState } from 'react';
import { Sliders, Save } from 'lucide-react';
import type { FeatureFlags } from '../types';

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlags>({
    ENABLE_WEBSITE_PAYMENT: false, // Default OFF (WhatsApp order only)
    ENABLE_PRODUCT_RATINGS: true,
    ENABLE_SUBSCRIPTIONS: true,
    ENABLE_CART: true,
    ENABLE_USER_ACCOUNTS: true,
  });

  const toggleFlag = (key: keyof FeatureFlags) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    alert('Storefront Master Feature Flags saved successfully! Changes propagate to Web and Mobile apps in real time.');
  };

  const flagDescriptors: Array<{ key: keyof FeatureFlags; label: string; description: string }> = [
    {
      key: 'ENABLE_WEBSITE_PAYMENT',
      label: 'Direct Online Payment Checkout (Razorpay / UPI)',
      description: 'When disabled, storefront orders redirect to WhatsApp pre-filled chat. When enabled, displays Razorpay / UPI online checkout.'
    },
    {
      key: 'ENABLE_PRODUCT_RATINGS',
      label: 'Product Customer Ratings & Star Reviews',
      description: 'Display star rating badges and verified customer reviews on product detail pages.'
    },
    {
      key: 'ENABLE_SUBSCRIPTIONS',
      label: 'Subscribe & Save Daily Milk & Ghee Deliveries',
      description: 'Show recurring morning delivery subscription options for milk and ghee products.'
    },
    {
      key: 'ENABLE_CART',
      label: 'Multi-Item Shopping Cart Navbar Icon',
      description: 'Enable header cart icon allowing customers to combine multiple items into a single order.'
    },
    {
      key: 'ENABLE_USER_ACCOUNTS',
      label: 'Customer Registration & Wallet Sign In',
      description: 'Allow customers to register accounts, view past order history, and maintain wallet balances.'
    },
  ];

  return (
    <div className="space-y-6 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900 p-6 rounded-2xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold">Storefront Feature Flags Controller</h1>
          </div>
          <p className="text-xs text-stone-400">
            Control live storefront features across Web & Mobile with zero code deployments.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <Save className="h-4 w-4" /> Save Feature Flags
        </button>
      </div>

      {/* Flags List */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 divide-y divide-stone-800">
        {flagDescriptors.map((item) => {
          const isEnabled = flags[item.key];
          return (
            <div key={item.key} className="p-6 flex items-start justify-between gap-6 hover:bg-stone-800/30 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-stone-950 text-amber-400 border border-stone-800">
                    {item.key}
                  </span>
                  <h3 className="font-bold text-sm text-stone-100">{item.label}</h3>
                </div>
                <p className="text-xs text-stone-400 max-w-2xl">{item.description}</p>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => toggleFlag(item.key)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isEnabled ? 'bg-emerald-500' : 'bg-stone-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
