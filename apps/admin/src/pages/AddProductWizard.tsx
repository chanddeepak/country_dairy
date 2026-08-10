import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useProductForm, type EditorTab } from '../hooks/useProductForm';
import CoreInfoTab from '../components/product-editor/CoreInfoTab';
import VariantsTab from '../components/product-editor/VariantsTab';
import GalleryTab from '../components/product-editor/GalleryTab';
import NutritionTab from '../components/product-editor/NutritionTab';
import type { Product } from '../types';
import type { CategoryItem } from './CategoryCMS';

interface AddProductWizardProps {
  onCancel: () => void;
  onComplete: (product: Product) => Promise<void> | void;
  categories?: CategoryItem[];
}

const STEPS: { key: EditorTab; label: string; hint: string }[] = [
  { key: 'core', label: 'Product Details', hint: 'Title, category and story' },
  { key: 'variants', label: 'Variants & Pricing', hint: 'Sizes, prices and stock' },
  { key: 'gallery', label: 'Photos & Video', hint: 'At least one photo' },
  { key: 'nutrition', label: 'Nutrition', hint: 'Optional' },
];

/**
 * The create flow, presented as steps over the same form as ProductEditor.
 *
 * This was 883 lines duplicating the editor's state, variant matrix and
 * gallery handling, which is why the two drifted apart — a fix in one did not
 * reach the other. Both now share useProductForm and the same tab components;
 * only the chrome differs.
 */
export default function AddProductWizard({
  onCancel,
  onComplete,
  categories = [],
}: AddProductWizardProps) {
  const form = useProductForm({ categories, onSave: onComplete });
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  // Keep the shared tab components in sync with the wizard's position.
  if (form.activeTab !== step.key) form.setActiveTab(step.key);

  /** Blocks moving on while the current step is incomplete. */
  const stepProblem = (): string | null => {
    if (step.key === 'core') {
      if (!form.core.title.trim()) return 'Enter a product title.';
      if (!form.core.categoryName) return 'Choose a category.';
    }

    if (step.key === 'variants') {
      if (form.variantMatrix.items.length === 0) return 'Add at least one variant.';
      for (const [i, v] of form.variantMatrix.items.entries()) {
        if (!v.sizeLabel.trim()) return `Variant ${i + 1} needs a size label.`;
        if (!v.sellingPrice) return `Variant ${i + 1} needs a selling price.`;
        if (!v.mrpPrice) return `Variant ${i + 1} needs an MRP.`;
      }
    }

    if (step.key === 'gallery' && form.gallery.items.length === 0) {
      return 'Add at least one photo so the product has a cover.';
    }

    return null;
  };

  const goNext = () => {
    const problem = stepProblem();
    if (problem) {
      form.setError(problem);
      return;
    }

    form.setError('');
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const goBack = () => {
    form.setError('');
    setStepIndex((i) => Math.max(0, i - 1));
  };

  return (
    <div className="relative space-y-6 text-[#2A2A2A]">
      {form.isSaving && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-9 w-9 text-[#064e3b] animate-spin" />
            <div>
              <h2 className="text-base font-serif font-bold mb-1">Creating product…</h2>
              <p className="text-xs text-[#6b6661]">Saving details, variants and media.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 bg-[#FAF8F3] hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors"
            title="Cancel"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-[#C59B27]" />
              <h1 className="text-xl font-serif font-bold">Add New Product</h1>
            </div>
            <p className="text-xs text-[#6b6661]">
              Step {stepIndex + 1} of {STEPS.length} — {step.hint}
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const isCurrent = i === stepIndex;
          const isDone = i < stepIndex;

          return (
            <button
              key={s.key}
              type="button"
              // Only steps already completed are clickable, so the form cannot
              // be skipped past a required field.
              onClick={() => isDone && setStepIndex(i)}
              disabled={!isDone && !isCurrent}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                isCurrent
                  ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-sm'
                  : isDone
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-stone-400 border-stone-200 cursor-not-allowed'
              }`}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="font-mono">{i + 1}</span>
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      {form.error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{form.error}</span>
        </div>
      )}

      {step.key === 'core' && <CoreInfoTab form={form} categories={categories} />}
      {step.key === 'variants' && <VariantsTab form={form} />}
      {step.key === 'gallery' && <GalleryTab form={form} />}
      {step.key === 'nutrition' && <NutritionTab form={form} />}

      {/* Footer navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm">
        <button
          type="button"
          onClick={stepIndex === 0 ? onCancel : goBack}
          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors"
        >
          {stepIndex === 0 ? 'Cancel' : 'Back'}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={form.save}
            disabled={form.isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Create Product
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
