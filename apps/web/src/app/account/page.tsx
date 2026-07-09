'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Calendar, Wallet, MapPin, LayoutDashboard, Plus, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Badge from '../../components/ui/Badge';
import AuthModal from '../../components/modals/AuthModal';
import CartDrawer from '../../components/cart/CartDrawer';
import { API_URL } from '../../lib/constants';

type Tab = 'overview' | 'orders' | 'subscriptions' | 'wallet' | 'addresses';

export default function AccountPage() {
  const router = useRouter();
  const { user, token, walletBalance } = useApp();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { setIsAuthOpen(true); return; }
    fetchOrders();
    fetchSubscriptions();
  }, [user, token]);

  const fetchOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch { /* noop */ }
  };

  const fetchSubscriptions = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(Array.isArray(data) ? data : []);
      }
    } catch { /* noop */ }
  };

  const addresses = user?.addresses || [];

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'orders', label: 'Orders', icon: <Package className="h-4 w-4" /> },
    { key: 'subscriptions', label: 'Subscriptions', icon: <Calendar className="h-4 w-4" /> },
    { key: 'wallet', label: 'Wallet', icon: <Wallet className="h-4 w-4" /> },
    { key: 'addresses', label: 'Addresses', icon: <MapPin className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[#FAF8F3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-serif font-black text-3xl text-[#2A2A2A] mb-8">My Account</h1>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
            {/* Tab Sidebar */}
            <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition ${
                    activeTab === tab.key
                      ? 'bg-[#3A6038] text-white shadow-md'
                      : 'text-[#6b6661] hover:bg-white hover:text-[#2A2A2A]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
                      <Wallet className="h-6 w-6 text-[#C59B27] mx-auto mb-2" />
                      <p className="text-2xl font-black text-[#3A6038]">₹{walletBalance}</p>
                      <p className="text-xs text-[#6b6661] mt-1">Wallet Balance</p>
                      <button onClick={() => setActiveTab('wallet')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                        Top Up
                      </button>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
                      <Package className="h-6 w-6 text-[#C59B27] mx-auto mb-2" />
                      <p className="text-2xl font-black text-[#2A2A2A]">{orders.length}</p>
                      <p className="text-xs text-[#6b6661] mt-1">Total Orders</p>
                      <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                        View All
                      </button>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
                      <Calendar className="h-6 w-6 text-[#C59B27] mx-auto mb-2" />
                      <p className="text-2xl font-black text-[#2A2A2A]">{subscriptions.filter((s) => s.status === 'ACTIVE').length}</p>
                      <p className="text-xs text-[#6b6661] mt-1">Active Subscriptions</p>
                      <button onClick={() => setActiveTab('subscriptions')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                        Manage
                      </button>
                    </div>
                  </div>

                  {/* Recent Orders */}
                  <div>
                    <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">Recent Orders</h3>
                    {orders.length === 0 ? (
                      <p className="text-xs text-[#6b6661]">No orders yet. Start shopping!</p>
                    ) : (
                      <div className="space-y-3">
                        {orders.slice(0, 3).map((order) => (
                          <div key={order.id} className="bg-white border border-stone-200 rounded-lg p-4 flex items-center justify-between">
                            <div>
                              <span className="text-sm font-bold text-[#2A2A2A]">{order.id.slice(0, 12)}…</span>
                              <span className="mx-2 text-[#6b6661]">•</span>
                              <span className="text-xs text-[#6b6661]">{new Date(order.createdAt).toLocaleDateString()}</span>
                              <span className="mx-2 text-[#6b6661]">•</span>
                              <span className="text-sm font-bold text-[#2A2A2A]">₹{order.total}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge status={order.status} />
                              <Link href={`/orders/${order.id}`} className="text-xs font-bold text-[#3A6038] hover:underline flex items-center gap-1">
                                Details <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ORDERS */}
              {activeTab === 'orders' && (
                <div>
                  <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">All Orders</h3>
                  {orders.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
                      <Package className="h-10 w-10 text-stone-200 mx-auto mb-3" />
                      <p className="text-sm font-bold text-stone-400">No orders yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((order) => (
                        <div key={order.id} className="bg-white border border-stone-200 rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-bold text-[#2A2A2A]">{order.id.slice(0, 12)}…</span>
                            <span className="mx-2 text-[#6b6661]">•</span>
                            <span className="text-xs text-[#6b6661]">{new Date(order.createdAt).toLocaleDateString()}</span>
                            <span className="mx-2 text-[#6b6661]">•</span>
                            <span className="text-sm font-bold text-[#2A2A2A]">₹{order.total}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge status={order.status} />
                            <Badge status={order.paymentStatus} />
                            <Link href={`/orders/${order.id}`} className="text-xs font-bold text-[#3A6038] hover:underline flex items-center gap-1">
                              Details <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUBSCRIPTIONS */}
              {activeTab === 'subscriptions' && (
                <div>
                  <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">My Subscriptions</h3>
                  {subscriptions.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
                      <Calendar className="h-10 w-10 text-stone-200 mx-auto mb-3" />
                      <p className="text-sm font-bold text-stone-400">No active subscriptions</p>
                      <button onClick={() => router.push('/products')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                        Browse subscribable products
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {subscriptions.map((sub) => (
                        <div key={sub.id} className="bg-white border border-stone-200 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-sm text-[#2A2A2A]">{sub.product?.name || 'Product'}</h4>
                            <Badge status={sub.status} />
                          </div>
                          <div className="text-xs text-[#6b6661] space-y-1">
                            <p>Quantity: {sub.quantity} per delivery</p>
                            <p>Frequency: {sub.frequency}</p>
                            <p>Next delivery: {sub.nextDelivery ? new Date(sub.nextDelivery).toLocaleDateString() : '—'}</p>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button className="text-xs font-bold text-amber-600 hover:underline">Pause</button>
                            <span className="text-stone-300">•</span>
                            <button className="text-xs font-bold text-[#6b6661] hover:underline">Edit Qty</button>
                            <span className="text-stone-300">•</span>
                            <button className="text-xs font-bold text-red-500 hover:underline">Cancel</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* WALLET */}
              {activeTab === 'wallet' && (
                <div>
                  <div className="bg-white border border-stone-200 rounded-xl p-8 text-center mb-8">
                    <p className="text-xs font-bold text-[#6b6661] uppercase tracking-wider mb-1">Current Balance</p>
                    <p className="text-4xl font-black text-[#3A6038] mb-4">₹{walletBalance}</p>
                    <button className="bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold py-3 px-8 rounded-lg transition">
                      Top Up Wallet
                    </button>
                  </div>

                  <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">Transaction History</h3>
                  <div className="bg-white border border-stone-200 rounded-xl p-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm border-b border-stone-100 pb-3">
                        <div>
                          <span className="font-bold text-emerald-600">+₹2,000</span>
                          <span className="ml-2 text-xs text-[#6b6661]">CREDIT</span>
                        </div>
                        <span className="text-xs text-[#6b6661]">Wallet Recharge</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-stone-100 pb-3">
                        <div>
                          <span className="font-bold text-red-500">-₹190</span>
                          <span className="ml-2 text-xs text-[#6b6661]">DEBIT</span>
                        </div>
                        <span className="text-xs text-[#6b6661]">Milk delivery Jul 5</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-bold text-red-500">-₹190</span>
                          <span className="ml-2 text-xs text-[#6b6661]">DEBIT</span>
                        </div>
                        <span className="text-xs text-[#6b6661]">Milk delivery Jul 4</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ADDRESSES */}
              {activeTab === 'addresses' && (
                <div>
                  <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">Saved Addresses</h3>
                  {addresses.length === 0 ? (
                    <p className="text-xs text-[#6b6661]">No saved addresses.</p>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {addresses.map((addr: any, idx: number) => (
                        <div key={addr.id} className="bg-white border border-stone-200 rounded-lg p-4 flex justify-between items-start">
                          <div>
                            <span className="text-sm font-bold text-[#2A2A2A]">📍 {addr.line1}, {addr.city} {addr.pincode}</span>
                            {idx === 0 && (
                              <span className="ml-2 text-[10px] font-bold text-[#3A6038] bg-[#3A6038]/10 px-2 py-0.5 rounded-full">DEFAULT</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button className="text-xs font-bold text-[#6b6661] hover:underline">Edit</button>
                            <button className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="flex items-center gap-2 text-xs font-bold text-[#3A6038] hover:underline">
                    <Plus className="h-3 w-3" />
                    Add New Address
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onCheckout={() => router.push('/checkout')} />
    </div>
  );
}
