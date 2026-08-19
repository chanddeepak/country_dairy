import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../../services/apiClient';
import type { ProductFormState } from '../../hooks/useProductForm';
import type { PackagingOption } from '../../types';

const field =
  'w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm text-[#2A2A2A] focus:outline-none focus:border-[#064e3b] transition-colors';

export default function VariantsTab({ form }: { form: ProductFormState }) {
  const { variantMatrix } = form;

  // Packaging is a lookup table, so the options come from the API rather than
  // a hardcoded union that would need a redeploy for oil or honey vessels.
  const [packaging, setPackaging] = useState<PackagingOption[]>([]);

  useEffect(() => {
    adminApi
      .getPackagingOptions()
      .then(setPackaging)
      .catch(() => setPackaging([]));
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#064e3b] uppercase tracking-wider">
            Variant Matrix
          </h2>
          <p className="text-xs text-[#6b6661] mt-0.5">
            Each size is a separate SKU with its own price and stock.
          </p>
        </div>

        <button
          type="button"
          onClick={variantMatrix.add}
          className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Variant
        </button>
      </div>

      {variantMatrix.items.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6b6661] font-medium border border-dashed border-stone-300 rounded-xl">
          No variants yet. A product needs at least one before it can be sold.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1180px]">
            <thead>
              <tr className="text-[10px] font-bold text-[#6b6661] uppercase tracking-wider border-b border-stone-200">
                <th className="pb-2 pr-3">Size Label</th>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">Selling ₹</th>
                <th className="pb-2 pr-3">MRP ₹</th>
                <th className="pb-2 pr-3">Stock</th>
                <th className="pb-2 pr-3">Low at</th>
                <th className="pb-2 pr-3">Packaging</th>
                {/* What the courier prices on. Without a weight a shipping
                    rate is either wrong or refused outright. */}
                <th className="pb-2 pr-3">Weight (g)</th>
                <th className="pb-2 pr-3" title="Used for volumetric weight">
                  Box L×W×H (cm)
                </th>
                <th className="pb-2 pr-3 text-center" title="Give this size its own card on the homepage">
                  On home
                </th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {variantMatrix.items.map((v, idx) => (
                <tr key={v.id}>
                  <td className="py-2.5 pr-3">
                    <input
                      type="text"
                      value={v.sizeLabel}
                      onChange={(e) => variantMatrix.update(idx, { sizeLabel: e.target.value })}
                      placeholder="1 Litre Glass Jar"
                      className={field}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => variantMatrix.update(idx, { sku: e.target.value })}
                      placeholder="auto"
                      className={`${field} font-mono text-xs`}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={v.sellingPrice || ''}
                      onChange={(e) =>
                        variantMatrix.update(idx, { sellingPrice: Number(e.target.value) })
                      }
                      placeholder="0"
                      className={`${field} font-bold w-24`}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={v.mrpPrice || ''}
                      onChange={(e) =>
                        variantMatrix.update(idx, { mrpPrice: Number(e.target.value) })
                      }
                      placeholder="0"
                      className={`${field} w-24`}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      value={v.stockQuantity ?? 0}
                      onChange={(e) =>
                        variantMatrix.update(idx, { stockQuantity: Number(e.target.value) })
                      }
                      className={`${field} w-20`}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      value={v.lowStockThreshold ?? 10}
                      onChange={(e) =>
                        variantMatrix.update(idx, { lowStockThreshold: Number(e.target.value) })
                      }
                      className={`${field} w-20`}
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={v.packagingCode ?? ''}
                      onChange={(e) =>
                        variantMatrix.update(idx, { packagingCode: e.target.value || null })
                      }
                      className={field}
                    >
                      <option value="">—</option>
                      {packaging.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2.5 pr-3">
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={v.weightGrams ?? ''}
                      onChange={(e) =>
                        variantMatrix.update(idx, {
                          // Empty means unknown, not zero. A jar that weighs
                          // nothing is not a jar, and sending 0 to a courier
                          // gets a rate nobody can honour.
                          weightGrams: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={`${field} w-24`}
                    />
                  </td>

                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1">
                      {(['lengthCm', 'widthCm', 'heightCm'] as const).map((dim, i) => (
                        <span key={dim} className="flex items-center gap-1">
                          {i > 0 && <span className="text-stone-400 text-[10px]">×</span>}
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder={dim === 'lengthCm' ? 'L' : dim === 'widthCm' ? 'W' : 'H'}
                            value={(v[dim] as number | null | undefined) ?? ''}
                            onChange={(e) =>
                              variantMatrix.update(idx, {
                                [dim]: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className={`${field} w-14`}
                          />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    {/* Per size, not per product: a product with four sizes
                        would otherwise fill the shelf on its own. */}
                    <input
                      type="checkbox"
                      checked={v.showOnHome ?? false}
                      onChange={(e) =>
                        variantMatrix.update(idx, { showOnHome: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#064e3b] cursor-pointer"
                      aria-label={`Show ${v.sizeLabel || 'this size'} on the homepage`}
                    />
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => variantMatrix.remove(v.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove variant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
