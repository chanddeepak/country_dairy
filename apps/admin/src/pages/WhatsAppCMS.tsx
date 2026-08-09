import { useEffect, useState } from 'react';
import { MessageCircle, Save, Loader2, Check } from 'lucide-react';
import { adminApi } from '../services/apiClient';
import type { WhatsAppConfig } from '../types';

const PLACEHOLDERS = ['{quantity}', '{product_name}', '{variant}', '{price}', '{total_amount}'];
const CART_PLACEHOLDERS = ['{items}', '{total_amount}'];

function renderPreview(template: string): string {
  return template
    .replace(/{quantity}/g, '2')
    .replace(/{product_name}/g, 'Country Dairy A2 Vedic Ghee')
    .replace(/{variant}/g, '1 Litre Glass Jar')
    .replace(/{price}/g, '1,450')
    .replace(/{items}/g, '- 2 x A2 Vedic Ghee (1 Litre Glass Jar) — ₹1,450\n- 1 x A2 Milk (1 Litre) — ₹95')
    .replace(/{total_amount}/g, '2,995');
}

export default function WhatsAppCMS() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    adminApi
      .getWhatsAppConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load configuration'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setError('');
    try {
      // Strip spaces, dashes and a leading + so the stored value is the digit
      // string wa.me expects.
      const normalized = { ...config, phoneNumber: config.phoneNumber.replace(/[^0-9]/g, '') };
      const saved = await adminApi.setWhatsAppConfig(normalized);
      setConfig(saved);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[#6b6661] font-medium">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading WhatsApp configuration…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
        {error || 'Configuration unavailable.'}
      </div>
    );
  }

  const update = <K extends keyof WhatsAppConfig>(key: K, value: WhatsAppConfig[K]) =>
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
            <h1 className="text-xl font-serif font-bold">WhatsApp Order Configuration</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            One number and message template for the whole storefront. Changing it here takes effect
            immediately — no redeploy.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 shrink-0"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>

      {error && (
        <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      {savedAt && !error && (
        <div className="p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium flex items-center gap-2">
          <Check className="h-4 w-4" /> Saved. The storefront will use this on its next load.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-5 text-xs">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.isEnabled}
              onChange={(e) => update('isEnabled', e.target.checked)}
              className="h-4 w-4 accent-[#064e3b]"
            />
            <span className="font-bold">Show WhatsApp ordering on the storefront</span>
          </label>

          <div>
            <label className="block font-bold mb-1">Business WhatsApp Number</label>
            <input
              type="text"
              value={config.phoneNumber}
              onChange={(e) => update('phoneNumber', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl font-mono text-sm focus:outline-none focus:border-[#064e3b]"
              placeholder="919997801112"
            />
            <p className="text-[11px] text-[#6b6661] mt-1.5">
              International format, digits only — country code first, no <code>+</code> or spaces.
            </p>
          </div>

          <div>
            <label className="block font-bold mb-1">Single Product Message</label>
            <textarea
              rows={7}
              value={config.messageTemplate}
              onChange={(e) => update('messageTemplate', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl font-mono leading-relaxed focus:outline-none focus:border-[#064e3b]"
            />
            <p className="text-[11px] text-[#6b6661] mt-1.5">
              Tags:{' '}
              {PLACEHOLDERS.map((p) => (
                <code key={p} className="text-[#C59B27] mr-1.5">
                  {p}
                </code>
              ))}
            </p>
          </div>

          <div>
            <label className="block font-bold mb-1">Whole Cart Message</label>
            <textarea
              rows={6}
              value={config.cartMessageTemplate}
              onChange={(e) => update('cartMessageTemplate', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl font-mono leading-relaxed focus:outline-none focus:border-[#064e3b]"
            />
            <p className="text-[11px] text-[#6b6661] mt-1.5">
              Used from the cart drawer.{' '}
              {CART_PLACEHOLDERS.map((p) => (
                <code key={p} className="text-[#C59B27] mr-1.5">
                  {p}
                </code>
              ))}
              — <code className="text-[#C59B27]">{'{items}'}</code> expands to one line per cart item.
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b6661]">
            Live Chat Preview
          </h2>

          <div className="bg-[#0b141a] p-4 rounded-2xl min-h-[200px] flex flex-col justify-end gap-2">
            <div className="bg-[#005c4b] text-stone-100 p-3.5 rounded-2xl rounded-tr-none text-xs whitespace-pre-wrap max-w-[90%] ml-auto shadow-md">
              {renderPreview(config.messageTemplate)}
              <div className="text-[9px] text-emerald-200 text-right mt-1 font-mono">10:42 AM ✓✓</div>
            </div>
          </div>

          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b6661] pt-2">
            Cart Message Preview
          </h2>
          <div className="bg-[#0b141a] p-4 rounded-2xl min-h-[160px] flex flex-col justify-end">
            <div className="bg-[#005c4b] text-stone-100 p-3.5 rounded-2xl rounded-tr-none text-xs whitespace-pre-wrap max-w-[90%] ml-auto shadow-md">
              {renderPreview(config.cartMessageTemplate)}
              <div className="text-[9px] text-emerald-200 text-right mt-1 font-mono">10:43 AM ✓✓</div>
            </div>
          </div>

          <div className="text-[11px] text-[#6b6661] pt-1">
            Opens{' '}
            <code className="text-[#064e3b] font-bold">
              wa.me/{config.phoneNumber.replace(/[^0-9]/g, '') || '…'}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
