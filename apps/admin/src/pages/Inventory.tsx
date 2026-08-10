import { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import type { Product } from '../types';
import { resolveImageUrl } from '../components/common/ImageUploader';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { adminApi } from '../services/apiClient';

interface InventoryProps {
  products: Product[];
  isLoading?: boolean;
  onUpdateProducts: (newProducts: Product[]) => void;
  onOpenAddWizard: () => void;
  onEditProduct: (product: Product) => void;
}

export default function Inventory({
  products,
  isLoading = false,
  onUpdateProducts,
  onOpenAddWizard,
  onEditProduct,
}: InventoryProps) {
  // Deletion Modal states
  const [deletingProduct, setDeletingProduct] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSubscription = async (productId: string) => {
    const updated = products.map(p => {
      if (p.id === productId) {
        return { ...p, isSubscriptionAllowed: !p.isSubscriptionAllowed };
      }
      return p;
    });
    onUpdateProducts(updated);
    try {
      await adminApi.toggleSubscription(productId);
    } catch (err) {
      console.warn('Failed to toggle subscription on API:', err);
    }
  };

  const toggleProductStatus = async (productId: string) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;
    const nextStatus = target.status === 'LIVE' ? 'DRAFT' : 'LIVE';

    const updated = products.map(p => {
      if (p.id === productId) {
        return { ...p, status: nextStatus as any };
      }
      return p;
    });
    onUpdateProducts(updated);
    try {
      await adminApi.updateProduct(productId, { status: nextStatus as any });
    } catch (err) {
      console.warn('Failed to update product status on API:', err);
    }
  };

  const handleDeleteProduct = (productId: string, title: string) => {
    setDeletingProduct({ id: productId, title });
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    const { id } = deletingProduct;
    setIsDeleting(true);
    onUpdateProducts(products.filter(p => p.id !== id));
    try {
      await adminApi.deleteProduct(id);
    } catch (err) {
      console.warn('Failed to delete product on API:', err);
    } finally {
      setIsDeleting(false);
      setDeletingProduct(null);
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
                <th className="py-3.5 px-4 whitespace-nowrap">Lab Report</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-stone-200 rounded-xl shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="w-40 h-4 bg-stone-200 rounded" />
                          <div className="w-24 h-3 bg-stone-200 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4"><div className="w-16 h-5 bg-stone-200 rounded-lg" /></td>
                    <td className="py-4 px-4"><div className="w-20 h-5 bg-stone-200 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="w-24 h-4 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4"><div className="w-16 h-4 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4"><div className="w-10 h-5 bg-stone-200 rounded-full mx-auto" /></td>
                    <td className="py-4 px-4"><div className="w-24 h-4 bg-stone-200 rounded" /></td>
                    <td className="py-4 px-4"><div className="w-20 h-5 bg-stone-200 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="w-16 h-4 bg-stone-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-stone-500">
                    <div className="max-w-xs mx-auto space-y-3">
                      <Package className="h-10 w-10 text-stone-300 mx-auto" />
                      <p className="font-semibold text-sm text-[#2A2A2A]">No products in database yet.</p>
                      <p className="text-xs text-stone-400">Click "Add New Product" to create your first catalog item.</p>
                      <button
                        onClick={onOpenAddWizard}
                        className="inline-flex items-center gap-1.5 bg-[#064e3b] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs hover:bg-[#065f46] transition-colors"
                      >
                        <Plus className="h-4 w-4" /> Add Product
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                const defaultVariant = p.variants?.[0];
                const displayPrice = defaultVariant ? defaultVariant.sellingPrice : ((p as any).price || 0);
                const totalStock = p.variants ? p.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0) : ((p as any).stock || 0);
                // Availability is derived from stock, with forceOutOfStock as
                // the explicit manual override.
                const isOutOfStock = p.forceOutOfStock === true || totalStock === 0;
                
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
                        {p.categoryName || (typeof (p as any).category === 'object' ? (p as any).category?.name : (p as any).category) || 'Dairy'}
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
                        {p.status === 'ARCHIVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-stone-200 text-stone-700 border border-stone-300 hover:bg-stone-300 transition-colors shadow-xs">
                            ⊘ ARCHIVED
                          </span>
                        ) : isOutOfStock ? (
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

                    {/* Latest published lab batch */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#6b6661] whitespace-nowrap">
                      {p.latestBatchNumber ? (
                        <span className="bg-[#FAF8F3] px-2 py-1 rounded border border-stone-200 font-bold text-[#2A2A2A]">
                          {p.latestBatchNumber}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">No Batch</span>
                      )}
                    </td>

                    {/* Lab tested — driven by a published lab report, not a flag */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {p.latestBatchTestDate ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs"
                          title={`Tested ${new Date(p.latestBatchTestDate).toLocaleDateString('en-IN')}`}
                        >
                          <CheckCircle2 className="h-3 w-3" /> LAB TESTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                          <AlertCircle className="h-3 w-3" /> NO REPORT
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
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Aesthetic Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingProduct}
        title="Permanently Delete Product?"
        message={deletingProduct ? `Are you sure you want to PERMANENTLY delete "${deletingProduct.title}"?\n\nThis will completely remove the product and all associated variants, images, lab reports, and reviews from the database. This action cannot be undone.` : ''}
        confirmLabel="Permanently Delete"
        cancelLabel="Keep Product"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  );
}
