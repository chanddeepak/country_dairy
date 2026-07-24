import { useState } from 'react';
import { Save } from 'lucide-react';

export default function TrustBadgesCMS() {
  const [trustBadges, setTrustBadges] = useState([
    { id: '1', title: '100% Certified A2', subtitle: 'Pure Gir Cow Bilona Method', icon: 'ShieldCheck' },
    { id: '2', title: 'Free Express Shipping', subtitle: 'On all orders above ₹499', icon: 'Truck' },
    { id: '3', title: 'Zero Preservatives', subtitle: 'Freshly packed & delivered', icon: 'Award' },
    { id: '4', title: 'Ethical Grazing', subtitle: 'Happy Cows, Pure Dairy', icon: 'Heart' },
  ]);

  const handleSave = () => {
    alert('Homepage Trust Badges updated successfully!');
  };

  return (
    <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-6 text-stone-100">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <h1 className="text-xl font-bold">Homepage Trust Badges & Value Propositions</h1>
          <p className="text-xs text-stone-400">Configure the 4 key value proposition cards displayed on the storefront homepage.</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md"
        >
          <Save className="h-4 w-4" /> Save Cards
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {trustBadges.map((badge, idx) => (
          <div key={badge.id} className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-2">
            <div>
              <label className="block font-bold text-stone-300 mb-1">Card {idx + 1} Title</label>
              <input
                type="text"
                value={badge.title}
                onChange={(e) => {
                  const updated = [...trustBadges];
                  updated[idx].title = e.target.value;
                  setTrustBadges(updated);
                }}
                className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded font-bold text-stone-100"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-400 mb-1">Subtitle</label>
              <input
                type="text"
                value={badge.subtitle}
                onChange={(e) => {
                  const updated = [...trustBadges];
                  updated[idx].subtitle = e.target.value;
                  setTrustBadges(updated);
                }}
                className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded text-stone-300"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
