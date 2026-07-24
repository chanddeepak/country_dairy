import { useState } from 'react';
import { MessageCircle, Save } from 'lucide-react';

export default function WhatsAppCMS() {
  const [targetNumber, setTargetNumber] = useState('+91 97777 66666');
  const [templateText, setTemplateText] = useState(`Hi Country Dairy! I would like to order:
- {quantity} x {product_name} ({variant}) — ₹{price} each
Total Amount: ₹{total_amount}

Please confirm my order and share delivery timing. Thank you!`);

  const handleSave = () => {
    alert('WhatsApp Pre-fill Message Template saved successfully!');
  };

  // Generate live preview with dummy data
  const livePreview = templateText
    .replace(/{quantity}/g, '2')
    .replace(/{product_name}/g, 'Country Dairy A2 Vedic Ghee')
    .replace(/{variant}/g, '1 Litre Glass Jar')
    .replace(/{price}/g, '1,499')
    .replace(/{total_amount}/g, '2,998');

  return (
    <div className="space-y-6 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900 p-6 rounded-2xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="h-6 w-6 text-emerald-400" />
            <h1 className="text-xl font-bold">WhatsApp Order Template Customizer</h1>
          </div>
          <p className="text-xs text-stone-400">
            Customize the target WhatsApp number and pre-filled order message format without code changes.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <Save className="h-4 w-4" /> Save WhatsApp Config
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form */}
        <div className="lg:col-span-7 bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-200 mb-1">Business WhatsApp Order Number</label>
            <input
              type="text"
              value={targetNumber}
              onChange={(e) => setTargetNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-200 mb-1">Pre-filled Order Message Template</label>
            <textarea
              rows={8}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono leading-relaxed"
            />
            <p className="text-[11px] text-stone-400 mt-2">
              Dynamic tags available: <code className="text-amber-400">{`{quantity}`}</code>, <code className="text-amber-400">{`{product_name}`}</code>, <code className="text-amber-400">{`{variant}`}</code>, <code className="text-amber-400">{`{price}`}</code>, <code className="text-amber-400">{`{total_amount}`}</code>.
            </p>
          </div>
        </div>

        {/* Right WhatsApp Screen Preview */}
        <div className="lg:col-span-5 bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Live WhatsApp Chat Preview</h2>
          <div className="bg-[#0b141a] p-4 rounded-2xl border border-stone-800 min-h-[280px] flex flex-col justify-end">
            <div className="bg-[#005c4b] text-stone-100 p-3.5 rounded-2xl rounded-tr-none text-xs font-sans whitespace-pre-wrap max-w-[85%] ml-auto shadow-md border border-[#00705b]">
              {livePreview}
              <div className="text-[9px] text-emerald-200 text-right mt-1 font-mono">10:42 AM ✓✓</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
