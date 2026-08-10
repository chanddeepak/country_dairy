import { ArrowLeft, Package, Save, Loader2, AlertCircle } from 'lucide-react';
import { useProductForm, type EditorTab } from '../hooks/useProductForm';
import CoreInfoTab from '../components/product-editor/CoreInfoTab';
import VariantsTab from '../components/product-editor/VariantsTab';
import GalleryTab from '../components/product-editor/GalleryTab';
import NutritionTab from '../components/product-editor/NutritionTab';
import type { Product } from '../types';
import type { CategoryItem } from './CategoryCMS';

interface ProductEditorProps {
  initialProduct?: Product;
  onBack: () => void;
  onSave: (product: Product) => Promise<void> | void;
  categories?: CategoryItem[];
}

const TABS: { key: EditorTab; label: string }[] = [
  { key: 'core', label: 'Core Info' },
  { key: 'variants', label: 'Variants & Stock' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'nutrition', label: 'Nutrition' },
];

/**
 * Shell only. Form state lives in useProductForm and each tab is its own
 * component — this file was 861 lines of state, gallery management, the
 * variant matrix and the save call intertwined, and was the source of most
 * bug fixes in this area.
 */
export default function ProductEditor({
  initialProduct,
  onBack,
  onSave,
  categories = [],
}: ProductEditorProps) {
  const form = useProductForm({ initialProduct, categories, onSave });

  const tabCount: Partial<Record<EditorTab, number>> = {
    variants: form.variantMatrix.items.length,
    gallery: form.gallery.items.length,
    nutrition: form.nutrition.rows.length,
  };

  return (
    <div className="relative space-y-6 text-[#2A2A2A]">
      {form.isSaving && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-9 w-9 text-[#064e3b] animate-spin" />
            <div>
              <h2 className="text-base font-serif font-bold mb-1">Saving changes…</h2>
              <p className="text-xs text-[#6b6661] leading-relaxed">
                Updating the product, its variants and its media gallery.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 bg-[#FAF8F3] hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors"
            title="Back to the product list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-5 w-5 text-[#064e3b]" />
              <h1 className="text-xl font-serif font-bold">
                {form.core.title || 'New Product'}
              </h1>
            </div>
            <p className="text-xs text-[#6b6661]">
              Title, variants and pricing, gallery, and nutrition.
            </p>
          </div>
        </div>

        <button
          onClick={form.save}
          disabled={form.isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 shrink-0"
        >
          <Save className="h-4 w-4" /> Save Product
        </button>
      </div>

      {form.error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{form.error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = form.activeTab === tab.key;
          const count = tabCount[tab.key];

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => form.setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-sm'
                  : 'bg-white text-[#6b6661] border-stone-200 hover:bg-stone-50'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-white/20' : 'bg-stone-100 text-[#6b6661]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {form.activeTab === 'core' && <CoreInfoTab form={form} categories={categories} />}
      {form.activeTab === 'variants' && <VariantsTab form={form} />}
      {form.activeTab === 'gallery' && <GalleryTab form={form} />}
      {form.activeTab === 'nutrition' && <NutritionTab form={form} />}
    </div>
  );
}
