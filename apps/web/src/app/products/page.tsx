'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ProductCard from '../../components/product/ProductCard';
import AuthModal from '../../components/modals/AuthModal';
import SubscriptionModal from '../../components/modals/SubscriptionModal';
import CartDrawer from '../../components/cart/CartDrawer';
import { FALLBACK_PRODUCTS, API_URL } from '../../lib/constants';

const CATEGORIES = ['All', 'Dairy', 'Oils', 'Honey'];
const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low → High', value: 'price-asc' },
  { label: 'Price: High → Low', value: 'price-desc' },
  { label: 'Rating', value: 'rating' },
];

export default function ProductsPage() {
  const { user, addToCart } = useApp();
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');

  // Modal state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubscrOpen, setIsSubscrOpen] = useState(false);
  const [subscrProduct, setSubscrProduct] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // try {
    //   const res = await fetch(`${API_URL}/catalog/products`);
    //   const data = await res.json();
    //   setProducts(Array.isArray(data) && data.length > 0 ? data : FALLBACK_PRODUCTS);
    // } catch {
    //   setProducts(FALLBACK_PRODUCTS);
    // }
    setProducts(FALLBACK_PRODUCTS);
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter((p) => {
        const cat = p.category?.name || '';
        const name = p.name.toLowerCase();
        if (activeCategory === 'Dairy') return cat === 'Dairy' || name.includes('milk') || name.includes('ghee');
        if (activeCategory === 'Oils') return cat === 'Oils' || name.includes('oil');
        if (activeCategory === 'Honey') return cat === 'Honey' || name.includes('honey');
        return true;
      });
    }

    // Sort
    if (sortBy === 'price-asc') result.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === 'price-desc') result.sort((a, b) => Number(b.price) - Number(a.price));
    if (sortBy === 'rating') result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

    return result;
  }, [products, searchQuery, activeCategory, sortBy]);

  const handleSubscribe = (product: any) => {
    if (!user) { setIsAuthOpen(true); return; }
    setSubscrProduct(product);
    setIsSubscrOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[#FAF8F3]">
        {/* Page Header */}
        <div className="bg-white border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="font-serif font-black text-3xl md:text-4xl text-[#2A2A2A] mb-2">Our Products</h1>
            <p className="text-sm text-[#6b6661]">
              Ethically sourced, lab-verified organic products delivered fresh to your doorstep.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-white border border-stone-200 pl-10 pr-4 py-2.5 rounded-lg text-sm text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] transition"
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Category Chips */}
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${
                      activeCategory === cat
                        ? 'bg-[#3A6038] text-white border-[#3A6038]'
                        : 'bg-white text-[#6b6661] border-stone-200 hover:border-[#3A6038] hover:text-[#3A6038]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-stone-200 px-3 py-2 rounded-lg text-xs font-bold text-[#2A2A2A] focus:outline-none focus:border-[#3A6038]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm font-bold text-stone-400">No products found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={addToCart}
                  onSubscribe={handleSubscribe}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SubscriptionModal isOpen={isSubscrOpen} onClose={() => { setIsSubscrOpen(false); setSubscrProduct(null); }} product={subscrProduct} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onCheckout={() => {}} />
    </div>
  );
}
