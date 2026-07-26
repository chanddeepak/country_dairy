import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Sparkles, Package } from 'lucide-react';
import type { Product } from '../types';
import { resolveImageUrl } from '../components/common/ImageUploader';

interface InventoryProps {
  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  batchCodeInput: string;
  setBatchCodeInput: (code: string) => void;
  purityScoreInput: string;
  setPurityScoreInput: (score: string) => void;
  phInput: string;
  setPhInput: (ph: string) => void;
  fatInput: string;
  handleRegisterBatchTest: (e: React.FormEvent) => void;
  onUpdateProducts: (newProducts: Product[]) => void;
  onOpenAddWizard: () => void;
  onEditProduct: (product: Product) => void;
}

export default function Inventory({
  products,
  selectedProductId,
  setSelectedProductId,
  batchCodeInput,
  setBatchCodeInput,
  purityScoreInput,
  setPurityScoreInput,
  handleRegisterBatchTest,
  onUpdateProducts,
  onOpenAddWizard,
  onEditProduct,
}: InventoryProps) {
  // Adulterant Screening states
  const [ureaDetected, setUreaDetected] = useState(false);
  const [starchDetected, setStarchDetected] = useState(false);
  const [detergentDetected, setDetergentDetected] = useState(false);
  const [dyesDetected, setDyesDetected] = useState(false);

  const hasAdulterants = ureaDetected || starchDetected || detergentDetected || dyesDetected;

  const onLabFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAdulterants) {
      alert('CANNOT CERTIFY BATCH: Adulterants Detected. Immediate inspection of farm dispatch batch is required.');
      return;
    }
    handleRegisterBatchTest(e);
    setUreaDetected(false);
    setStarchDetected(false);
    setDetergentDetected(false);
    setDyesDetected(false);
  };

  const toggleSubscription = (productId: string) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        return { ...p, isSubscriptionAllowed: !p.isSubscriptionAllowed };
      }
      return p;
    });
    onUpdateProducts(updated);
  };

  const toggleProductStatus = (productId: string) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        const nextStatus = p.status === 'LIVE' ? 'DRAFT' : 'LIVE';
        return { ...p, status: nextStatus as any };
      }
      return p;
    });
    onUpdateProducts(updated);
  };

  const handleDeleteProduct = (productId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}" from the catalog?`)) {
      onUpdateProducts(products.filter(p => p.id !== productId));
    }
  };

  return (
    <div className="space-y-8 text-[#2A2A2A]">
      {/* Product Catalog Panel */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-6">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-5 w-5 text-[#064e3b]" />
              <h2 className="text-xl font-serif font-bold text-[#2A2A2A]">Product Catalog & Inventory Engine</h2>
            </div>
            <p className="text-xs text-[#6b6661]">
              Manage product titles, multi-variant pricing, stock levels, QA lab certifications, and subscription toggles.
            </p>
          </div>

          {/* SINGLE UNIFIED ADD PRODUCT BUTTON */}
          <button 
            onClick={onOpenAddWizard}
            className="flex items-center justify-center gap-2 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm transition-all transform active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Product (4-Step Wizard)</span>
          </button>
        </div>

        {/* Catalog Data Table */}
        <div className="overflow-x-auto rounded-xl border border-stone-200/80 shadow-xs bg-white">
          <table className="w-full text-left text-xs text-[#2A2A2A] border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#FAF8F3] text-[#6b6661] font-bold border-b border-stone-200 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 min-w-[280px]">Product Details</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Price & Variants</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Total Stock</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Subscription Allowed</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Active Batch</th>
                <th className="py-3.5 px-4 whitespace-nowrap">QA Certificate</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {products.map((p) => {
                const defaultVariant = p.variants?.[0];
                const displayPrice = defaultVariant ? defaultVariant.sellingPrice : ((p as any).price || 0);
                const totalStock = p.variants ? p.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0) : ((p as any).stock || 0);
                const isOutOfStock = p.status === 'OUT_OF_STOCK' || totalStock === 0;
                
                const rawImg = p.galleryImages?.find(img => img.isPrimary)?.imageUrl 
                  || p.galleryImages?.[0]?.imageUrl 
                  || (p as any).imageUrl;
                const resolvedImg = rawImg ? resolveImageUrl(rawImg) : null;

                return (
                  <tr key={p.id} className="hover:bg-[#FAF8F3]/60 transition-colors">
                    {/* Product Name & Image Thumbnail */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-stone-100 border border-stone-200 rounded-xl shrink-0 flex items-center justify-center overflow-hidden shadow-xs relative">
                          {resolvedImg ? (
                            <img 
                              src={resolvedImg} 
                              alt={p.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => { 
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="h-5 w-5 text-stone-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-[#2A2A2A] flex items-center gap-1.5 flex-wrap">
                            <span className="truncate max-w-[220px]" title={p.title}>{p.title}</span>
                            {p.badgeText && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#C59B27]/15 text-[#C59B27] border border-[#C59B27]/30 shrink-0">
                                {p.badgeText}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#6b6661] font-mono mt-0.5 truncate">
                            /{p.slug} • {p.variants?.length || 1} Variant(s)
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-xs text-[#064e3b] bg-[#064e3b]/10 px-2.5 py-1 rounded-lg border border-[#064e3b]/20">
                        {p.categoryName || (p as any).category || 'Dairy'}
                      </span>
                    </td>

                    {/* Single Clean Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleProductStatus(p.id)}
                        className="inline-flex items-center focus:outline-none cursor-pointer"
                        title={p.status === 'LIVE' ? 'Click to set status to DRAFT (Offline)' : 'Click to set status to LIVE (Published)'}
                      >
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-700 border border-red-200 shadow-xs">
                            ● OUT OF STOCK
                          </span>
                        ) : p.status === 'LIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-xs">
                            ● LIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors shadow-xs">
                            ○ DRAFT (OFF)
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Price & Variants */}
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                      <div>₹{displayPrice}</div>
                      {p.variants && p.variants.length > 1 && (
                        <div className="text-[10px] text-[#6b6661] font-normal font-sans">
                          {p.variants.length} pack sizes
                        </div>
                      )}
                    </td>

                    {/* Total Stock */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <span className={`font-bold ${totalStock === 0 ? 'text-red-600 font-black' : 'text-stone-900'}`}>
                        {totalStock} units
                      </span>
                    </td>

                    {/* Subscription Allowed Toggle */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSubscription(p.id)}
                        className="inline-flex items-center justify-center text-[#064e3b] hover:opacity-80 transition-opacity"
                        title={p.isSubscriptionAllowed ? 'Subscription Enabled' : 'Subscription Disabled (Default)'}
                      >
                        {p.isSubscriptionAllowed ? (
                          <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-extrabold text-[10px] shadow-xs">
                            <ToggleRight className="h-4 w-4 text-emerald-600" /> ON
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200 font-extrabold text-[10px] shadow-xs">
                            <ToggleLeft className="h-4 w-4 text-stone-400" /> OFF
                          </div>
                        )}
                      </button>
                    </td>

                    {/* Active Batch */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#6b6661] whitespace-nowrap">
                      {p.batchCode ? (
                        <span className="bg-[#FAF8F3] px-2 py-1 rounded border border-stone-200 font-bold text-[#2A2A2A]">
                          {p.batchCode}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">No Batch</span>
                      )}
                    </td>

                    {/* QA Certificate */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {p.verified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                          <CheckCircle2 className="h-3 w-3" /> VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                          <AlertCircle className="h-3 w-3" /> PENDING QA
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => onEditProduct(p)}
                        className="px-3 py-1.5 bg-[#FAF8F3] hover:bg-stone-100 text-[#064e3b] border border-stone-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors shadow-xs"
                        title="Edit Full Product Details & Variants"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit Details
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(p.id, p.title)}
                        className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lab Certification & Adulterant Screening Tool */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
        <div className="border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#C59B27]" />
            <h3 className="text-base font-serif font-bold text-[#2A2A2A]">Rapid Farm QA & Lab Certificate Generator</h3>
          </div>
          <p className="text-xs text-[#6b6661]">
            Certify batch purity before warehouse dispatch. Screening for 4 primary adulterants (Urea, Starch, Detergent, Synthetic Dyes).
          </p>
        </div>

        <form onSubmit={onLabFormSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-[#2A2A2A] mb-1">Target Product *</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-bold"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#2A2A2A] mb-1">New Batch Code *</label>
              <input
                type="text"
                required
                value={batchCodeInput}
                onChange={(e) => setBatchCodeInput(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#2A2A2A] font-mono font-bold"
                placeholder="e.g. BATCH-2026-MILK02"
              />
            </div>

            <div>
              <label className="block font-bold text-[#2A2A2A] mb-1">Purity Score (%)</label>
              <input
                type="text"
                value={purityScoreInput}
                onChange={(e) => setPurityScoreInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-[#064e3b] font-bold"
              />
            </div>
          </div>

          {/* Adulterant Screening Checks */}
          <div className="p-4 bg-[#FAF8F3] rounded-xl border border-stone-200/80 space-y-2">
            <div className="font-bold text-[#2A2A2A] mb-2 uppercase text-[10px] tracking-wider">Adulterant Screening Safety Locks</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ureaDetected} onChange={(e) => setUreaDetected(e.target.checked)} className="accent-red-600" />
                <span className={ureaDetected ? 'text-red-600 font-bold' : 'text-[#6b6661]'}>Urea Detected</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={starchDetected} onChange={(e) => setStarchDetected(e.target.checked)} className="accent-red-600" />
                <span className={starchDetected ? 'text-red-600 font-bold' : 'text-[#6b6661]'}>Starch Powder</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={detergentDetected} onChange={(e) => setDetergentDetected(e.target.checked)} className="accent-red-600" />
                <span className={detergentDetected ? 'text-red-600 font-bold' : 'text-[#6b6661]'}>Detergent Residue</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dyesDetected} onChange={(e) => setDyesDetected(e.target.checked)} className="accent-red-600" />
                <span className={dyesDetected ? 'text-red-600 font-bold' : 'text-[#6b6661]'}>Synthetic Dyes</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Issue Batch QA Purity Certificate
          </button>
        </form>
      </div>
    </div>
  );
}
