import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Loader2, Check, GripVertical } from 'lucide-react';
import { adminApi } from '../services/apiClient';
import ConfirmDialog from '../components/common/ConfirmDialog';
import type { TrustBadge } from '../types';

/** Lucide names the storefront already renders. */
const ICON_OPTIONS = [
  'ShieldCheck',
  'Truck',
  'Award',
  'Heart',
  'Leaf',
  'Sparkles',
  'BadgeCheck',
  'PackageCheck',
];

type DraftBadge = Partial<TrustBadge> & { title: string; subtitle: string };

export default function TrustBadgesCMS() {
  const [badges, setBadges] = useState<DraftBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ index: number; badge: DraftBadge } | null>(null);

  useEffect(() => {
    adminApi
      .getTrustBadges()
      .then((rows) => setBadges(rows))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load trust badges'))
      .finally(() => setIsLoading(false));
  }, []);

  const update = (idx: number, patch: Partial<DraftBadge>) =>
    setBadges((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  const addBadge = () =>
    setBadges((prev) => [
      ...prev,
      { title: '', subtitle: '', iconName: 'ShieldCheck', displayOrder: prev.length + 1, isActive: true },
    ]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { index, badge } = pendingDelete;

    try {
      // Only rows that exist server-side need a delete call.
      if (badge.id) await adminApi.deleteTrustBadge(badge.id);
      setBadges((prev) => prev.filter((_, i) => i !== index));
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the badge');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const saved: DraftBadge[] = [];

      for (const [idx, badge] of badges.entries()) {
        if (!badge.title.trim()) continue;

        const payload = {
          title: badge.title.trim(),
          subtitle: badge.subtitle.trim(),
          iconName: badge.iconName ?? 'ShieldCheck',
          displayOrder: idx + 1,
          isActive: badge.isActive ?? true,
        };

        saved.push(
          badge.id
            ? await adminApi.updateTrustBadge(badge.id, payload)
            : await adminApi.createTrustBadge(payload),
        );
      }

      setBadges(saved);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save trust badges');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[#6b6661] font-medium">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading trust badges…
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-serif font-bold">Homepage Trust Badges</h1>
          <p className="text-xs text-[#6b6661]">
            The value-proposition cards shown on the storefront homepage. Order here is the order
            customers see.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={addBadge}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-[#064e3b] border border-stone-200 font-bold text-xs rounded-xl transition-all"
          >
            <Plus className="h-4 w-4" /> Add Badge
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving…' : 'Save Badges'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      {savedAt && !error && (
        <div className="p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium flex items-center gap-2">
          <Check className="h-4 w-4" /> Saved. The storefront picks this up on its next load.
        </div>
      )}

      {badges.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200/80 shadow-sm text-center">
          <p className="text-xs text-[#6b6661] font-medium mb-4">No trust badges configured yet.</p>
          <button
            onClick={addBadge}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white font-bold text-xs rounded-xl"
          >
            <Plus className="h-4 w-4" /> Add the first badge
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {badges.map((badge, idx) => (
            <div
              key={badge.id ?? `new-${idx}`}
              className="p-4 bg-white rounded-2xl border border-stone-200/80 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#6b6661]">
                  <GripVertical className="h-3.5 w-3.5" /> Card {idx + 1}
                </div>
                <button
                  onClick={() => setPendingDelete({ index: idx, badge })}
                  className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  title="Remove badge"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <label className="block font-bold mb-1">Title</label>
                <input
                  type="text"
                  value={badge.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder="100% Certified A2"
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg font-bold focus:outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Subtitle</label>
                <input
                  type="text"
                  value={badge.subtitle}
                  onChange={(e) => update(idx, { subtitle: e.target.value })}
                  placeholder="Pure Gir Cow Bilona Method"
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg focus:outline-none focus:border-[#064e3b]"
                />
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block font-bold mb-1">Icon</label>
                  <select
                    value={badge.iconName ?? 'ShieldCheck'}
                    onChange={(e) => update(idx, { iconName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg font-bold focus:outline-none focus:border-[#064e3b]"
                  >
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={badge.isActive ?? true}
                    onChange={(e) => update(idx, { isActive: e.target.checked })}
                    className="h-4 w-4 accent-[#064e3b]"
                  />
                  <span className="font-bold">Visible</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Remove this badge?"
        message={`"${pendingDelete?.badge.title || 'This badge'}" will no longer appear on the homepage.`}
        confirmLabel="Remove badge"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
