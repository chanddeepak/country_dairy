'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Calendar,
  Wallet,
  MapPin,
  LayoutDashboard,
  Plus,
  ArrowUpRight,
  UserCog,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useStoreConfig } from '../../context/StoreConfigContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Badge from '../../components/ui/Badge';
import AuthModal from '../../components/modals/AuthModal';
import CartDrawer from '../../components/cart/CartDrawer';
import { API_URL } from '../../lib/constants';

type Tab = 'overview' | 'orders' | 'profile' | 'subscriptions' | 'wallet' | 'addresses';

const addrField =
  'w-full px-3 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm text-[#2A2A2A] focus:outline-none focus:border-[#3A6038] transition';
const addrLabel = 'block text-[11px] font-bold text-[#6b6661] uppercase tracking-wider mb-1.5';

const TAB_KEYS: Tab[] = ['overview', 'orders', 'profile', 'subscriptions', 'wallet', 'addresses'];

function isTab(value: string | null): value is Tab {
  return !!value && (TAB_KEYS as string[]).includes(value);
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    token,
    walletBalance,
    isSessionReady,
    addAddress,
    updateAddress,
    deleteAddress,
    updateProfile,
    changePassword,
  } = useApp();
  const { isFlagOn } = useStoreConfig();

  const walletEnabled = isFlagOn('ENABLE_WALLET');
  const subscriptionsEnabled = isFlagOn('ENABLE_SUBSCRIPTIONS');

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  // The tab lives in the URL rather than in state. It was local state, so
  // "My Orders" in the navbar had nowhere to point and had to link to
  // /account — landing on Overview, indistinguishable from "My Account".
  // It also means a tab survives a refresh and can be linked to.
  const requestedTab = searchParams.get('tab');
  const activeTab: Tab = isTab(requestedTab) ? requestedTab : 'overview';

  const setActiveTab = (tab: Tab) => {
    router.replace(tab === 'overview' ? '/account' : `/account?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    // Wait for the stored session to load. Without this the modal opens on
    // every visit before localStorage has been read, at customers who are
    // already signed in.
    if (!isSessionReady) return;

    if (!user) { setIsAuthOpen(true); return; }
    fetchOrders();
    fetchSubscriptions();
  }, [isSessionReady, user, token]);

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

  // --- Address book ---
  //
  // The whole tab was markup. "Add New Address", "Edit" and "Delete" were
  // buttons with no onClick, so nothing happened when a customer pressed them.

  const emptyAddrForm = { line1: '', line2: '', city: '', state: '', postalCode: '', phone: '' };

  const [isAddrFormOpen, setIsAddrFormOpen] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState(emptyAddrForm);
  const [addrError, setAddrError] = useState('');
  const [isSavingAddr, setIsSavingAddr] = useState(false);
  const [addrBusyId, setAddrBusyId] = useState<string | null>(null);
  const [pendingDeleteAddr, setPendingDeleteAddr] = useState<any>(null);

  const openAddrForm = (addr?: any) => {
    setAddrError('');
    setEditingAddrId(addr?.id ?? null);
    setAddrForm(
      addr
        ? {
            line1: addr.line1 ?? '',
            line2: addr.line2 ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            postalCode: addr.postalCode ?? '',
            phone: addr.phone ?? '',
          }
        : emptyAddrForm,
    );
    setIsAddrFormOpen(true);
  };

  const closeAddrForm = () => {
    setIsAddrFormOpen(false);
    setEditingAddrId(null);
    setAddrForm(emptyAddrForm);
    setAddrError('');
  };

  /** Mirrors the API's DTO so a bad field is caught before the round trip. */
  const addrProblem = (): string | null => {
    if (addrForm.line1.trim().length < 3) return 'Enter the flat or house number and street.';
    if (addrForm.city.trim().length < 2) return 'Enter a city.';
    if (addrForm.state.trim().length < 2) return 'Enter a state.';
    if (!/^[1-9][0-9]{5}$/.test(addrForm.postalCode)) return 'Enter a valid 6-digit PIN code.';
    if (!/^[6-9][0-9]{9}$/.test(addrForm.phone)) return 'Enter a valid 10-digit mobile number.';
    return null;
  };

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = addrProblem();
    if (problem) {
      setAddrError(problem);
      return;
    }

    setAddrError('');
    setIsSavingAddr(true);
    try {
      const saved = editingAddrId
        ? await updateAddress(editingAddrId, {
            line1: addrForm.line1.trim(),
            line2: addrForm.line2.trim() || undefined,
            city: addrForm.city.trim(),
            state: addrForm.state.trim(),
            postalCode: addrForm.postalCode,
            phone: addrForm.phone,
          })
        : await addAddress(
            addrForm.line1.trim(),
            addrForm.city.trim(),
            addrForm.state.trim(),
            addrForm.postalCode,
            addrForm.phone,
            addrForm.line2.trim() || undefined,
          );

      if (!saved.ok) {
        setAddrError(saved.error || 'Could not save that address.');
        if (saved.signedOut) setIsAuthOpen(true);
        return;
      }

      closeAddrForm();
    } finally {
      setIsSavingAddr(false);
    }
  };

  const makeDefault = async (id: string) => {
    setAddrBusyId(id);
    setAddrError('');
    try {
      const result = await updateAddress(id, { isDefault: true });
      if (!result.ok) {
        setAddrError(result.error || 'Could not change the default address.');
        if (result.signedOut) setIsAuthOpen(true);
      }
    } finally {
      setAddrBusyId(null);
    }
  };

  const confirmDeleteAddress = async () => {
    if (!pendingDeleteAddr) return;

    setAddrBusyId(pendingDeleteAddr.id);
    setAddrError('');
    try {
      const result = await deleteAddress(pendingDeleteAddr.id);
      if (result.ok) {
        setPendingDeleteAddr(null);
      } else {
        setPendingDeleteAddr(null);
        setAddrError(result.error || 'Could not delete that address.');
        if (result.signedOut) setIsAuthOpen(true);
      }
    } finally {
      setAddrBusyId(null);
    }
  };

  // --- Profile & security ---

  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);
  const [isSavingPw, setIsSavingPw] = useState(false);

  // Seed the form once the stored user arrives, not on every render, so typing
  // is not overwritten by the value it started from.
  useEffect(() => {
    if (user) setProfileForm({ name: user.name ?? '', phone: user.phone ?? '' });
  }, [user?.id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (profileForm.name.trim().length < 2) {
      setProfileError('Enter your name.');
      return;
    }
    if (profileForm.phone && !/^[6-9][0-9]{9}$/.test(profileForm.phone)) {
      setProfileError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setProfileError('');
    setProfileSaved(false);
    setIsSavingProfile(true);
    try {
      const result = await updateProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone || undefined,
      });

      if (!result.ok) {
        setProfileError(result.error || 'Could not update your profile.');
        if (result.signedOut) setIsAuthOpen(true);
        return;
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pwForm.current) {
      setPwError('Enter your current password.');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('Your new password must be at least 8 characters.');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('The two new passwords do not match.');
      return;
    }

    setPwError('');
    setPwSaved(false);
    setIsSavingPw(true);
    try {
      const result = await changePassword(pwForm.current, pwForm.next);

      if (!result.ok) {
        setPwError(result.error || 'Could not change your password.');
        return;
      }

      setPwForm({ current: '', next: '', confirm: '' });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 4000);
    } finally {
      setIsSavingPw(false);
    }
  };

  // A tab for a disabled feature is hidden, not merely empty. Wallet and
  // Subscriptions were listed unconditionally, so the account page advertised
  // a wallet the store does not have.
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'orders', label: 'Orders', icon: <Package className="h-4 w-4" /> },
    ...(subscriptionsEnabled
      ? [{ key: 'subscriptions' as Tab, label: 'Subscriptions', icon: <Calendar className="h-4 w-4" /> }]
      : []),
    ...(walletEnabled
      ? [{ key: 'wallet' as Tab, label: 'Wallet', icon: <Wallet className="h-4 w-4" /> }]
      : []),
    { key: 'addresses', label: 'Addresses', icon: <MapPin className="h-4 w-4" /> },
    { key: 'profile', label: 'Profile & Security', icon: <UserCog className="h-4 w-4" /> },
  ];

  // ?tab=wallet must not open a hidden tab just because it was typed in.
  const visibleTab: Tab = TABS.some((t) => t.key === activeTab) ? activeTab : 'overview';

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
                    visibleTab === tab.key
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
              {visibleTab === 'overview' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {walletEnabled && (
                      <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
                        <Wallet className="h-6 w-6 text-[#C59B27] mx-auto mb-2" />
                        <p className="text-2xl font-black text-[#3A6038]">₹{walletBalance}</p>
                        <p className="text-xs text-[#6b6661] mt-1">Wallet Balance</p>
                        <button onClick={() => setActiveTab('wallet')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                          Top Up
                        </button>
                      </div>
                    )}
                    <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
                      <Package className="h-6 w-6 text-[#C59B27] mx-auto mb-2" />
                      <p className="text-2xl font-black text-[#2A2A2A]">{orders.length}</p>
                      <p className="text-xs text-[#6b6661] mt-1">Total Orders</p>
                      <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                        View All
                      </button>
                    </div>
                    {subscriptionsEnabled && (
                      <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
                        <Calendar className="h-6 w-6 text-[#C59B27] mx-auto mb-2" />
                        <p className="text-2xl font-black text-[#2A2A2A]">{subscriptions.filter((s) => s.status === 'ACTIVE').length}</p>
                        <p className="text-xs text-[#6b6661] mt-1">Active Subscriptions</p>
                        <button onClick={() => setActiveTab('subscriptions')} className="text-xs font-bold text-[#3A6038] mt-3 hover:underline">
                          Manage
                        </button>
                      </div>
                    )}
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
                              <span className="text-sm font-bold text-[#2A2A2A]">{order.orderNumber}</span>
                              <span className="mx-2 text-[#6b6661]">•</span>
                              <span className="text-xs text-[#6b6661]">{new Date(order.createdAt).toLocaleDateString()}</span>
                              <span className="mx-2 text-[#6b6661]">•</span>
                              <span className="text-sm font-bold text-[#2A2A2A]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</span>
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
              {visibleTab === 'orders' && (
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
                            <span className="text-sm font-bold text-[#2A2A2A]">{order.orderNumber}</span>
                            <span className="mx-2 text-[#6b6661]">•</span>
                            <span className="text-xs text-[#6b6661]">{new Date(order.createdAt).toLocaleDateString()}</span>
                            <span className="mx-2 text-[#6b6661]">•</span>
                            <span className="text-sm font-bold text-[#2A2A2A]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</span>
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
              {visibleTab === 'subscriptions' && (
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
              {visibleTab === 'wallet' && (
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

              {/* PROFILE & SECURITY */}
              {visibleTab === 'profile' && (
                <div className="space-y-6 max-w-xl">
                  {/* Details */}
                  <form onSubmit={saveProfile} className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
                    <h3 className="font-bold text-sm text-[#2A2A2A]">Your details</h3>

                    {profileError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                        {profileError}
                      </div>
                    )}
                    {profileSaved && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
                        <Check className="h-4 w-4 shrink-0" /> Saved.
                      </div>
                    )}

                    <div>
                      <label className={addrLabel}>Name</label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        placeholder="Your full name"
                        className={addrField}
                      />
                    </div>

                    <div>
                      <label className={addrLabel}>Mobile number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={profileForm.phone}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, '') })
                        }
                        placeholder="10-digit mobile"
                        className={addrField}
                      />
                      <p className="text-[11px] text-[#6b6661] mt-1.5">
                        Used for delivery updates and to reach you about an order.
                      </p>
                    </div>

                    <div>
                      <label className={addrLabel}>Email</label>
                      <input
                        type="email"
                        value={user?.email ?? ''}
                        readOnly
                        disabled
                        className={`${addrField} opacity-60 cursor-not-allowed`}
                      />
                      {/* Email is the sign-in identity. Changing it needs a
                          verification step of its own, so it is read-only
                          rather than a field that silently fails. */}
                      <p className="text-[11px] text-[#6b6661] mt-1.5">
                        You sign in with this address. Write to us if you need it changed.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-5 py-2.5 bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {isSavingProfile ? 'Saving…' : 'Save details'}
                    </button>
                  </form>

                  {/* Password */}
                  <form onSubmit={savePassword} className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
                    <h3 className="font-bold text-sm text-[#2A2A2A]">Change password</h3>

                    {pwError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                        {pwError}
                      </div>
                    )}
                    {pwSaved && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
                        <Check className="h-4 w-4 shrink-0" /> Password changed.
                      </div>
                    )}

                    <div>
                      <label className={addrLabel}>Current password</label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={pwForm.current}
                        onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                        className={addrField}
                      />
                    </div>

                    <div>
                      <label className={addrLabel}>New password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={pwForm.next}
                        onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                        placeholder="At least 8 characters"
                        className={addrField}
                      />
                    </div>

                    <div>
                      <label className={addrLabel}>Confirm new password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                        className={addrField}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingPw}
                      className="px-5 py-2.5 bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {isSavingPw ? 'Changing…' : 'Change password'}
                    </button>
                  </form>
                </div>
              )}

              {/* ADDRESSES */}
              {visibleTab === 'addresses' && (
                <div>
                  <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">Saved Addresses</h3>

                  {addrError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                      {addrError}
                    </div>
                  )}

                  {addresses.length === 0 && !isAddrFormOpen ? (
                    <p className="text-xs text-[#6b6661] mb-6">No saved addresses.</p>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {addresses.map((addr: any) => (
                        <div key={addr.id} className="bg-white border border-stone-200 rounded-lg p-4 flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-[#2A2A2A]">
                              📍 {[addr.line1, addr.line2].filter(Boolean).join(', ')}
                            </span>
                            <p className="text-xs text-[#6b6661] mt-0.5">
                              {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                              {addr.phone ? ` · ${addr.phone}` : ''}
                            </p>
                            {/* isDefault comes from the API — position in the
                                list is not the same thing once one is deleted. */}
                            {addr.isDefault && (
                              <span className="inline-block mt-1.5 text-[10px] font-bold text-[#3A6038] bg-[#3A6038]/10 px-2 py-0.5 rounded-full">
                                DEFAULT
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openAddrForm(addr)}
                                className="text-xs font-bold text-[#6b6661] hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setPendingDeleteAddr(addr)}
                                disabled={addrBusyId === addr.id}
                                className="text-xs font-bold text-red-500 hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                            {!addr.isDefault && (
                              <button
                                onClick={() => makeDefault(addr.id)}
                                disabled={addrBusyId === addr.id}
                                className="text-[11px] font-bold text-[#3A6038] hover:underline disabled:opacity-50"
                              >
                                Set as default
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAddrFormOpen ? (
                    <form
                      onSubmit={saveAddress}
                      className="bg-white border border-stone-200 rounded-xl p-5 space-y-3"
                    >
                      <h4 className="font-bold text-sm text-[#2A2A2A]">
                        {editingAddrId ? 'Edit address' : 'New address'}
                      </h4>

                      <input
                        type="text"
                        value={addrForm.line1}
                        onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
                        placeholder="Flat / house no., building, street *"
                        className={addrField}
                      />
                      <input
                        type="text"
                        value={addrForm.line2}
                        onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })}
                        placeholder="Area, landmark (optional)"
                        className={addrField}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={addrForm.city}
                          onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                          placeholder="City *"
                          className={addrField}
                        />
                        <input
                          type="text"
                          value={addrForm.state}
                          onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                          placeholder="State *"
                          className={addrField}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={addrForm.postalCode}
                          onChange={(e) =>
                            setAddrForm({ ...addrForm, postalCode: e.target.value.replace(/\D/g, '') })
                          }
                          placeholder="6-digit PIN code *"
                          className={addrField}
                        />
                        <input
                          type="tel"
                          maxLength={10}
                          value={addrForm.phone}
                          onChange={(e) =>
                            setAddrForm({ ...addrForm, phone: e.target.value.replace(/\D/g, '') })
                          }
                          placeholder="10-digit mobile *"
                          className={addrField}
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingAddr}
                          className="px-5 py-2.5 bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                        >
                          {isSavingAddr ? 'Saving…' : editingAddrId ? 'Save changes' : 'Save address'}
                        </button>
                        <button
                          type="button"
                          onClick={closeAddrForm}
                          className="px-4 py-2.5 border border-stone-200 text-[#6b6661] text-xs font-bold rounded-lg hover:bg-[#FAF8F3] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => openAddrForm()}
                      className="flex items-center gap-2 text-xs font-bold text-[#3A6038] hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Add New Address
                    </button>
                  )}

                  {/* Delete confirmation */}
                  {pendingDeleteAddr && (
                    <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4">
                        <h4 className="font-serif font-bold text-base text-[#2A2A2A]">
                          Delete this address?
                        </h4>
                        <p className="text-xs text-[#6b6661] leading-relaxed">
                          {[pendingDeleteAddr.line1, pendingDeleteAddr.city, pendingDeleteAddr.postalCode]
                            .filter(Boolean)
                            .join(', ')}
                          <br />
                          Orders already placed keep their own copy of the address, so past
                          deliveries are unaffected.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPendingDeleteAddr(null)}
                            className="px-4 py-2.5 border border-stone-200 text-[#6b6661] text-xs font-bold rounded-lg hover:bg-[#FAF8F3] transition"
                          >
                            Keep it
                          </button>
                          <button
                            onClick={confirmDeleteAddress}
                            disabled={addrBusyId === pendingDeleteAddr.id}
                            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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

/**
 * useSearchParams makes the tree below it client-rendered during prerender, so
 * Next requires a Suspense boundary around it. Without one the build fails on
 * this route.
 */
export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center">
          <div className="animate-pulse text-sm text-[#6b6661]">Loading your account…</div>
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
