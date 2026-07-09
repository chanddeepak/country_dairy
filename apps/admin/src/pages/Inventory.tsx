import { useState } from 'react';
import { AlertTriangle, Plus, X, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  batchCode: string;
  verified: boolean;
  isSubscriptionAllowed?: boolean;
}

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
}

export default function Inventory({
  products,
  selectedProductId,
  setSelectedProductId,
  batchCodeInput,
  setBatchCodeInput,
  purityScoreInput,
  setPurityScoreInput,
  phInput,
  setPhInput,
  handleRegisterBatchTest,
  onUpdateProducts,
}: InventoryProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditingProduct, setCurrentEditingProduct] = useState<Product | null>(null);

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


  // Form inputs for Add Product
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Dairy');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');

  // Handle Edit/Save Product
  const [editProductName, setEditProductName] = useState('');
  const [editProductCategory, setEditProductCategory] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');
  const [editProductStock, setEditProductStock] = useState('');

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) { alert('Name is required'); return; }
    if (Number(newProductPrice) <= 0) { alert('Price must be positive'); return; }
    if (Number(newProductStock) < 0) { alert('Stock cannot be negative'); return; }

    const newProd: Product = {
      id: String(products.length + 1),
      name: newProductName,
      price: Number(newProductPrice),
      stock: Number(newProductStock),
      category: newProductCategory,
      batchCode: '',
      verified: false,
      isSubscriptionAllowed: true,
    };

    onUpdateProducts([...products, newProd]);
    setShowAddModal(false);
    setNewProductName('');
    setNewProductPrice('');
    setNewProductStock('');
  };

  const handleOpenEdit = (p: Product) => {
    setCurrentEditingProduct(p);
    setEditProductName(p.name);
    setEditProductCategory(p.category);
    setEditProductPrice(String(p.price));
    setEditProductStock(String(p.stock));
    setShowEditModal(true);
  };

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEditingProduct) return;
    if (!editProductName.trim()) { alert('Name is required'); return; }
    if (Number(editProductPrice) <= 0) { alert('Price must be positive'); return; }
    if (Number(editProductStock) < 0) { alert('Stock cannot be negative'); return; }

    const updated = products.map(p => {
      if (p.id === currentEditingProduct.id) {
        return {
          ...p,
          name: editProductName,
          category: editProductCategory,
          price: Number(editProductPrice),
          stock: Number(editProductStock),
        };
      }
      return p;
    });

    onUpdateProducts(updated);
    setShowEditModal(false);
    setCurrentEditingProduct(null);
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

  return (
    <div className="space-y-8">
      {/* Product Catalog list */}
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Product Catalog & Lab Certifications</h2>
            <p className="text-xs text-stone-500">Add, edit, toggle subscriptions and certify fresh dairy batches.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary bg-[#064e3b] text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#065f46] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        </div>

        <table className="data-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
              <th className="p-4">Product Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Subscr Allowed</th>
              <th className="p-4">Active Batch</th>
              <th className="p-4">QA Certificate</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/30 transition-colors text-sm">
                <td className="p-4 font-bold text-stone-800">{p.name}</td>
                <td className="p-4 text-stone-600">{p.category}</td>
                <td className="p-4 font-bold text-stone-800">₹{p.price}</td>
                <td className="p-4">
                  <span className={`font-bold ${p.stock < 50 ? 'text-amber-600 flex items-center gap-1' : 'text-stone-700'}`}>
                    {p.stock < 50 && <AlertTriangle className="h-3.5 w-3.5" />}
                    {p.stock} units
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={() => toggleSubscription(p.id)} className="text-stone-400 hover:text-stone-600 transition-colors">
                    {p.isSubscriptionAllowed !== false ? (
                      <ToggleRight className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="h-6 w-6" />
                    )}
                  </button>
                </td>
                <td className="p-4"><code className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs">{p.batchCode || 'Not Assigned'}</code></td>
                <td className="p-4">
                  <StatusBadge status={p.verified ? 'verified' : 'unverified'} />
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 hover:bg-stone-150 rounded text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 text-xs font-bold transition"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lab Certification block */}
      <div className={`screen-panel p-6 rounded-2xl border shadow-sm transition-colors ${hasAdulterants ? 'bg-red-50/50 border-red-200' : 'bg-white border-stone-200'}`}>
        <div className="screen-header mb-6">
          <h2 className={`text-lg font-bold border-b pb-4 ${hasAdulterants ? 'text-red-900 border-red-200' : 'text-stone-800 border-stone-100'}`}>
            🔬 QA Lab Certificate Publisher
          </h2>
        </div>

        {hasAdulterants && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold">CANNOT CERTIFY BATCH: Adulterants Detected</strong>
              <span className="text-xs">Immediate inspection of farm dispatch batch is required. Pure certificates are blocked.</span>
            </div>
          </div>
        )}

        <form onSubmit={onLabFormSubmit}>
          <div className="form-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="form-group flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600 uppercase">Select Product:</label>
              <select 
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="form-control bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-[#064e3b]"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600 uppercase">Batch Code:</label>
              <input 
                type="text" 
                value={batchCodeInput}
                onChange={(e) => setBatchCodeInput(e.target.value)}
                placeholder="BATCH-2026-MILK02"
                className="form-control bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-[#064e3b]"
              />
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600 uppercase">Purity Score (%):</label>
              <input 
                type="text" 
                value={purityScoreInput}
                onChange={(e) => setPurityScoreInput(e.target.value)}
                placeholder="99.8%"
                className="form-control bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-[#064e3b]"
              />
            </div>

            <div className="form-group flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600 uppercase">pH Level:</label>
              <input 
                type="text" 
                value={phInput}
                onChange={(e) => setPhInput(e.target.value)}
                className="form-control bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-[#064e3b]"
              />
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-xs font-bold text-stone-600 uppercase mb-3">Adulterant Screening Checklist:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-stone-50/50 p-4 rounded-xl border border-stone-200">
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={ureaDetected} onChange={(e) => setUreaDetected(e.target.checked)} className="rounded text-[#064e3b] focus:ring-[#064e3b] h-4 w-4" />
                Urea Detected
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={starchDetected} onChange={(e) => setStarchDetected(e.target.checked)} className="rounded text-[#064e3b] focus:ring-[#064e3b] h-4 w-4" />
                Starch Detected
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={detergentDetected} onChange={(e) => setDetergentDetected(e.target.checked)} className="rounded text-[#064e3b] focus:ring-[#064e3b] h-4 w-4" />
                Detergent Detected
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input type="checkbox" checked={dyesDetected} onChange={(e) => setDyesDetected(e.target.checked)} className="rounded text-[#064e3b] focus:ring-[#064e3b] h-4 w-4" />
                Synthetic Dyes
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={hasAdulterants}
            className={`btn-primary font-semibold text-xs px-6 py-3 rounded-lg transition-colors ${
              hasAdulterants 
                ? 'bg-stone-300 text-stone-500 cursor-not-allowed border-none' 
                : 'bg-[#064e3b] text-white hover:bg-[#065f46]'
            }`}
          >
            Publish Lab Certificate
          </button>
        </form>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-stone-200 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-stone-900 text-base">Add New Catalog Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-600 transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-600">Product Name:</label>
                <input type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm" placeholder="Country Dairy Fresh Paneer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-600">Category:</label>
                <select value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm">
                  <option value="Dairy">Dairy</option>
                  <option value="Oils">Oils</option>
                  <option value="Honey">Honey</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-600">Price (INR):</label>
                  <input type="number" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm" placeholder="250" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-600">Initial Stock:</label>
                  <input type="number" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm" placeholder="100" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#064e3b] text-white font-semibold py-3 rounded-lg text-sm mt-4 hover:bg-[#065f46] transition">
                Create Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-stone-200 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-stone-900 text-base">Edit Product</h3>
              <button onClick={() => setShowEditModal(false)} className="text-stone-400 hover:text-stone-600 transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-600">Product Name:</label>
                <input type="text" value={editProductName} onChange={e => setEditProductName(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-600">Category:</label>
                <select value={editProductCategory} onChange={e => setEditProductCategory(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm">
                  <option value="Dairy">Dairy</option>
                  <option value="Oils">Oils</option>
                  <option value="Honey">Honey</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-600">Price (INR):</label>
                  <input type="number" value={editProductPrice} onChange={e => setEditProductPrice(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-600">Stock:</label>
                  <input type="number" value={editProductStock} onChange={e => setEditProductStock(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded-lg text-sm" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#064e3b] text-white font-semibold py-3 rounded-lg text-sm mt-4 hover:bg-[#065f46] transition">
                Save Product Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
