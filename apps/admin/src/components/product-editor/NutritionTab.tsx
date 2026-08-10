import { Plus, Trash2 } from 'lucide-react';
import type { ProductFormState } from '../../hooks/useProductForm';

const field =
  'w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm text-[#2A2A2A] focus:outline-none focus:border-[#064e3b] transition-colors';

export default function NutritionTab({ form }: { form: ProductFormState }) {
  const { nutrition } = form;

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#064e3b] uppercase tracking-wider">
            Nutrition Facts
          </h2>
          <p className="text-xs text-[#6b6661] mt-0.5">
            Free-form rows, so each product line can carry what is relevant to it —
            fat content for ghee, floral source for honey.
          </p>
        </div>

        <button
          type="button"
          onClick={nutrition.add}
          className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      {nutrition.rows.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6b6661] font-medium border border-dashed border-stone-300 rounded-xl">
          No nutrition facts yet. The storefront hides this section when empty.
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-[10px] font-bold text-[#6b6661] uppercase tracking-wider">
            <span>Label</span>
            <span>Value</span>
            <span className="w-8" />
          </div>

          {nutrition.rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
              <input
                type="text"
                value={row.key}
                onChange={(e) => nutrition.update(idx, { key: e.target.value })}
                placeholder="Energy"
                className={field}
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => nutrition.update(idx, { value: e.target.value })}
                placeholder="898 kcal"
                className={field}
              />
              <button
                type="button"
                onClick={() => nutrition.remove(idx)}
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove row"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
