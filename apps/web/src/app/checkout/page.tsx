'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, CreditCard, Wallet, ShieldCheck, Plus, CheckCircle2, UserCheck, KeyRound, PhoneCall, AlertCircle, Mail, Lock, User, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { API_URL } from '../../lib/constants';
import { INDIAN_STATES, PINCODE_PATTERN, normaliseState } from '../../lib/indianStates';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useStoreConfig } from '../../context/StoreConfigContext';

export default function CheckoutPage() {
  const router = useRouter();
  const { isFlagOn } = useStoreConfig();
  const walletEnabled = isFlagOn('ENABLE_WALLET');
  const otpLoginEnabled = isFlagOn('ENABLE_OTP_LOGIN');
  const { user, cart, walletBalance, checkout, verifyPayment, addAddress, sendOtp, verifyOtp, setLoginPhone, loginWithEmail, registerWithEmail, syncCart, unsyncedCount } = useApp();

  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'wallet'>('razorpay');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Mock Razorpay Modal state
  const [showMockRazorpay, setShowMockRazorpay] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{
    orderId: string;
    orderNumber?: string;
    amount: number;
    breakdown?: {
      subtotal: number;
      discountAmount: number;
      taxAmount: number;
      deliveryCharges: number;
      totalAmount: number;
    };
  } | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Inline Auth Form States for Guest Checkout (Mobile vs Email)
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authPhone, setAuthPhone] = useState('+919876543210');
  const [authOtp, setAuthOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Address form state
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ line1: '', city: '', state: '', pincode: '', phone: '' });
  const [pincodeNote, setPincodeNote] = useState<{ ok: boolean; text: string } | null>(null);

  /**
   * Fill in the town and state from the PIN code.
   *
   * Advisory, never blocking. If the lookup is slow, down, or simply does not
   * know a code, the customer types the two fields themselves and the order
   * goes through — an address form that depends on somebody else's uptime is
   * a checkout that stops working for reasons the shop cannot see or fix.
   *
   * Only what the customer has not already filled in is overwritten, so a
   * deliberate correction is not undone by an answer arriving late.
   */
  const onPincodeChange = async (raw: string) => {
    const pincode = raw.replace(/\D/g, '').slice(0, 6);
    setNewAddr((prev) => ({ ...prev, pincode }));

    if (pincode.length < 6) {
      setPincodeNote(null);
      return;
    }

    if (!PINCODE_PATTERN.test(pincode)) {
      setPincodeNote({ ok: false, text: 'That does not look like a PIN code.' });
      return;
    }

    setPincodeNote({ ok: true, text: 'Checking…' });
    try {
      const res = await fetch(`${API_URL}/geo/pincode/${pincode}`);
      if (!res.ok) {
        setPincodeNote({
          ok: false,
          text: 'We could not place that PIN code. Please fill in the town and state.',
        });
        return;
      }

      const found = await res.json();
      const state = normaliseState(found.state);

      setNewAddr((prev) => ({
        ...prev,
        city: prev.city.trim() ? prev.city : found.district ?? '',
        state: prev.state ? prev.state : state,
      }));

      setPincodeNote({
        ok: true,
        text: [found.district, found.state].filter(Boolean).join(', '),
      });
    } catch {
      // Network trouble on our side, and not the customer's problem to solve.
      setPincodeNote(null);
    }
  };
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState('');

  // Set default address when user loads
  useEffect(() => {
    if (user?.addresses?.length > 0 && !selectedAddress) {
      setSelectedAddress(user.addresses[0].id);
    }
  }, [user]);

  // Same normalised line total the drawer uses. Reading product.price here
  // produced "₹NaN" throughout the order summary.
  const subtotal = cart.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);

  // Indicative only. The authoritative figures come back from /orders/checkout
  // and are shown in the confirmation step before anything is charged.
  const FREE_DELIVERY_THRESHOLD = 500;
  const estimatedDelivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : 40;
  const total = subtotal + estimatedDelivery;

  const handleGuestEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      let success = false;
      if (isRegistering) {
        success = await registerWithEmail(authEmail, authPassword, authName);
      } else {
        success = await loginWithEmail(authEmail, authPassword);
      }
      if (!success) {
        setAuthError(isRegistering ? 'Registration failed. Email may already be registered.' : 'Invalid email or password.');
      }
    } catch {
      setAuthError('Authentication error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      setLoginPhone(authPhone);
      const sent = await sendOtp(authPhone);
      if (sent) {
        setOtpSent(true);
      } else {
        setAuthError('Failed to send verification code. Please try again.');
      }
    } catch {
      setAuthError('Error sending OTP.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const verified = await verifyOtp(authOtp);
      if (!verified) {
        setAuthError('Invalid OTP code. Please use: 123456');
      }
    } catch {
      setAuthError('OTP verification error.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrError('');
    if (!newAddr.line1 || !newAddr.city || !newAddr.state || !newAddr.pincode || !newAddr.phone) {
      setAddrError('All address fields including Contact Mobile Number are required.');
      return;
    }
    setAddrSaving(true);
    try {
      const result = await addAddress(
        newAddr.line1,
        newAddr.city,
        newAddr.state,
        newAddr.pincode,
        newAddr.phone,
      );

      if (result.ok) {
        setShowNewAddr(false);
        setNewAddr({ line1: '', city: '', state: '', pincode: '', phone: '' });
      } else {
        // Show why, not just that. "Please try again" against an expired
        // session sends the customer round the same loop for ever.
        setAddrError(result.error || 'Failed to save address. Please try again.');
      }
    } catch {
      setAddrError('Error saving address.');
    } finally {
      setAddrSaving(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    if (!selectedAddress) { setError('Please select a delivery address to proceed.'); return; }
    setError('');
    setProcessing(true);

    try {
      // Flush anything an earlier network blip left unsaved, so the order
      // contains everything the cart showed rather than silently less.
      const stillFailing = await syncCart();
      if (stillFailing.length > 0) {
        setError(
          `We could not confirm ${stillFailing.join(', ')} with the server. ` +
            'Please check your cart and try again.',
        );
        setProcessing(false);
        return;
      }

      const orderResult = await checkout(selectedAddress);

      if (orderResult?.orderId) {
        // Trigger Mock Razorpay Payment Modal
        // Use the server's numbers, not the client's estimate.
        setPendingOrderData({
          orderId: orderResult.orderId,
          orderNumber: orderResult.orderNumber,
          amount: orderResult.breakdown?.totalAmount ?? orderResult.amount ?? total,
          breakdown: orderResult.breakdown,
        });
        setShowMockRazorpay(true);
      } else {
        setError(orderResult?.message || 'Checkout failed. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmMockPayment = async () => {
    if (!pendingOrderData) return;
    setVerifyingPayment(true);
    try {
      const mockPayId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const verified = await verifyPayment(pendingOrderData.orderId, mockPayId);
      if (verified) {
        setShowMockRazorpay(false);
        router.push(`/orders/${pendingOrderData.orderId}?status=success`);
      } else {
        setError('Payment verification failed on server.');
      }
    } catch {
      setError('Error verifying payment signature.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const addresses = user?.addresses || [];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => {}} onAuthOpen={() => {}} />

      <main className="flex-1 bg-[#FAF8F3]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-serif font-black text-3xl text-[#2A2A2A] mb-8">Checkout</h1>

          {/* Guest Checkout - Ask for login first */}
          {!user ? (
            <div className="bg-white border border-stone-200 rounded-xl p-8 shadow-sm max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-[#3A6038]/10 text-[#3A6038] rounded-full flex items-center justify-center mx-auto mb-6">
                <UserCheck className="h-8 w-8" />
              </div>
              <h2 className="font-serif font-black text-2xl text-[#2A2A2A] mb-2">Secure Checkout</h2>
              <p className="text-xs text-[#6b6661] mb-6">
                Sign in to use your saved addresses and to track this order.
              </p>

              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-bold mb-4 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {authError}
                </div>
              )}

              {/* Email and password is the live sign-in path. OTP only appears
                  when ENABLE_OTP_LOGIN is on, and it needs an SMS provider. */}
              <form onSubmit={handleGuestEmailAuth} className="space-y-4 text-left">
                {isRegistering && (
                  <div>
                    <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Your Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full bg-[#FAF8F3] border border-stone-300 pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#3A6038]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#FAF8F3] border border-stone-300 pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#3A6038]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={isRegistering ? 'At least 8 characters' : '••••••••'}
                      className="w-full bg-[#FAF8F3] border border-stone-300 pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#3A6038]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {authLoading
                    ? 'Please wait…'
                    : isRegistering
                      ? 'Create account & continue'
                      : 'Sign in & continue'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setAuthError('');
                  }}
                  className="w-full text-xs text-[#6b6661] hover:text-[#3A6038] font-bold transition"
                >
                  {isRegistering
                    ? 'Already have an account? Sign in'
                    : "New here? Create an account"}
                </button>
              </form>

              {otpLoginEnabled && (
                <div className="mt-6 pt-5 border-t border-stone-100 text-left">
                  {!otpSent ? (
                    <form onSubmit={handleGuestRequestOtp} className="space-y-3">
                      <label className="text-xs font-bold text-[#2A2A2A] block">Or sign in with your mobile</label>
                      <div className="relative">
                        <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          type="tel"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder="+919876543210"
                          className="w-full bg-[#FAF8F3] border border-stone-300 pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#3A6038]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full border-2 border-[#3A6038] text-[#3A6038] font-bold py-3 rounded-xl text-sm transition disabled:opacity-50"
                      >
                        {authLoading ? 'Sending…' : 'Request OTP'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleGuestVerifyOtp} className="space-y-3">
                      <label className="text-xs font-bold text-[#2A2A2A] block">Verification Code</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          type="text"
                          value={authOtp}
                          onChange={(e) => setAuthOtp(e.target.value)}
                          maxLength={6}
                          className="w-full bg-[#FAF8F3] border border-stone-300 pl-10 pr-4 py-3 rounded-xl text-sm tracking-[0.3em] font-black focus:outline-none focus:border-[#3A6038]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-[#3A6038] text-white font-bold py-3 rounded-xl text-sm transition disabled:opacity-50"
                      >
                        {authLoading ? 'Verifying…' : 'Verify & Continue'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : cart.length === 0 && !processing ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl">
              <p className="text-lg font-bold text-stone-400 mb-4">Your cart is empty</p>
              <button
                onClick={() => router.push('/')}
                className="bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3 px-8 rounded-lg transition"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-bold mb-6">
                  {error}
                </div>
              )}

              {unsyncedCount > 0 && !error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-medium mb-6">
                  {unsyncedCount} item{unsyncedCount === 1 ? '' : 's'} in your cart could not be
                  saved earlier. We will confirm {unsyncedCount === 1 ? 'it' : 'them'} when you
                  place the order.
                </div>
              )}

              {/* Step 1: Delivery Address */}
              <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
                <h2 className="font-bold text-sm text-[#2A2A2A] flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-[#3A6038]" />
                  STEP 1: DELIVERY ADDRESS
                </h2>
                
                <div className="space-y-4">
                  {/* List existing addresses */}
                  {addresses.length > 0 && (
                    <div className="grid grid-cols-1 gap-3">
                      {addresses.map((addr: any) => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition ${
                            selectedAddress === addr.id
                              ? 'border-[#3A6038] bg-[#3A6038]/5 shadow-sm'
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            checked={selectedAddress === addr.id}
                            onChange={() => { setSelectedAddress(addr.id); setShowNewAddr(false); }}
                            className="accent-[#3A6038] mt-1 shrink-0"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#2A2A2A]">{addr.line1}, {addr.city}</span>
                              {addr.isDefault && (
                                <span className="text-[9px] font-bold text-[#3A6038] bg-[#3A6038]/10 px-2 py-0.5 rounded-full">DEFAULT</span>
                              )}
                            </div>
                            <p className="text-xs text-[#6b6661]">{addr.state} - {addr.postalCode}</p>
                            {addr.phone && (
                              <p className="text-xs text-[#3A6038] font-bold">📞 Contact: {addr.phone}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Add New Address Form Inline */}
                  {!showNewAddr ? (
                    <button
                      onClick={() => setShowNewAddr(true)}
                      data-testid="add-address"
                      className="flex items-center gap-2 text-xs font-bold text-[#3A6038] hover:underline px-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add New Address
                    </button>
                  ) : (
                    <form onSubmit={handleSaveAddress} data-testid="address-form" className="border border-stone-200 p-5 rounded-xl bg-stone-50/50 space-y-3.5">
                      <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider">Add Delivery Address</h3>
                      {addrError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-bold">
                          {addrError}
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Street / Apartment Address"
                          value={newAddr.line1}
                          onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
                          className="w-full bg-white border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#3A6038]"
                        />
                        {/* PIN code first, because it fills in the other two.
                            Typing the town and then the code that contradicts
                            it is how parcels end up in the wrong district. */}
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Pincode"
                            data-testid="address-pincode"
                            value={newAddr.pincode}
                            onChange={(e) => onPincodeChange(e.target.value)}
                            className="bg-white border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#3A6038]"
                          />
                          <input
                            type="text"
                            placeholder="City"
                            data-testid="address-city"
                            value={newAddr.city}
                            onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                            className="bg-white border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#3A6038]"
                          />
                          {/* A list rather than free text: the courier matches
                              on this, and GST turns on whether the supply
                              crossed a state line. "UK" and "Uttrakhand" for
                              the same place are not harmless. */}
                          <select
                            data-testid="address-state"
                            value={newAddr.state}
                            onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                            className={`bg-white border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#3A6038] ${
                              newAddr.state ? 'text-[#2A2A2A]' : 'text-stone-400'
                            }`}
                          >
                            <option value="">State</option>
                            {INDIAN_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        {pincodeNote && (
                          <p
                            data-testid="pincode-note"
                            className={`text-[11px] ${
                              pincodeNote.ok ? 'text-[#3A6038]' : 'text-amber-700'
                            }`}
                          >
                            {pincodeNote.text}
                          </p>
                        )}
                        <input
                          type="tel"
                          placeholder="Delivery contact mobile (e.g. 9876543210)"
                          value={newAddr.phone}
                          onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                          className="w-full bg-white border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#3A6038]"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => { setShowNewAddr(false); setAddrError(''); }}
                          className="text-xs font-bold text-stone-500 hover:bg-stone-100 px-3.5 py-2 rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addrSaving}
                          className="bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
                        >
                          {addrSaving ? 'Saving...' : 'Save & Continue'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Step 2: Order Summary */}
              <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
                <h2 className="font-bold text-sm text-[#2A2A2A] mb-4">STEP 2: ORDER SUMMARY</h2>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                      <span className="text-[#6b6661] min-w-0">
                        {item.productSlug ? (
                          <Link
                            href={`/products/${item.productSlug}${item.variantId ? `?variant=${item.variantId}` : ''}`}
                            className="font-bold text-[#2A2A2A] hover:text-[#3A6038] hover:underline transition"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          <span className="font-bold text-[#2A2A2A]">{item.productName}</span>
                        )}
                        {item.variantLabel ? ` (${item.variantLabel})` : ''} × {item.quantity}
                      </span>
                      <span className="font-bold text-[#2A2A2A] whitespace-nowrap">
                        ₹{item.lineTotal}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-stone-100 pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#6b6661]">Subtotal</span>
                      <span className="font-bold">₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#6b6661]">Delivery</span>
                      <span className={estimatedDelivery === 0 ? 'font-bold text-[#3A6038]' : 'font-bold'}>
                        {estimatedDelivery === 0 ? 'FREE' : `₹${estimatedDelivery}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-black pt-2 border-t border-stone-100">
                      <span>TOTAL</span>
                      <span>₹{total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Payment Method */}
              <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
                <h2 className="font-bold text-sm text-[#2A2A2A] flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4 text-[#3A6038]" />
                  STEP 3: PAYMENT METHOD
                </h2>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${
                    paymentMethod === 'razorpay' ? 'border-[#3A6038] bg-[#3A6038]/5' : 'border-stone-200 hover:border-stone-300'
                  }`}>
                    <input type="radio" name="payment" checked={paymentMethod === 'razorpay'}
                      onChange={() => setPaymentMethod('razorpay')} className="accent-[#3A6038]" />
                    <div>
                      <span className="text-sm font-bold text-[#2A2A2A]">Pay via Razorpay</span>
                      <span className="text-xs text-[#6b6661] block">UPI / Card / Netbanking</span>
                    </div>
                  </label>
                  {walletEnabled && (
                  <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${
                    paymentMethod === 'wallet' ? 'border-[#3A6038] bg-[#3A6038]/5' : 'border-stone-200 hover:border-stone-300'
                  }`}>
                    <input type="radio" name="payment" checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')} className="accent-[#3A6038]" />
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[#C59B27]" />
                      <span className="text-sm font-bold text-[#2A2A2A]">Pay from Wallet</span>
                      <span className="text-xs text-[#6b6661]">(Balance: ₹{walletBalance})</span>
                    </div>
                  </label>
                  )}
                </div>
              </div>

              {/* Place Order */}
              <button
                onClick={handlePlaceOrder}
                disabled={processing}
                data-testid="place-order"
                className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-4 rounded-xl text-lg transition disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                {processing ? 'Processing Order...' : `Place Order — ₹${total}`}
              </button>

              <p className="flex items-center justify-center gap-1 text-xs text-[#6b6661] mt-4">
                <ShieldCheck className="h-3.5 w-3.5" />
                Payments secured by Razorpay
              </p>
            </>
          )}
        </div>
      </main>

      {/* Payment confirmation. Razorpay is in mock mode, so this stands in for
          the gateway's own modal until live keys are configured. */}
      {showMockRazorpay && pendingOrderData && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-[#3A6038] text-white p-5">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-bold text-sm">Confirm your payment</span>
              </div>
              <p className="text-[11px] text-white/80">
                Order {pendingOrderData.orderNumber ?? pendingOrderData.orderId.slice(0, 8)}
              </p>
            </div>

            <div className="p-5 space-y-3 text-sm">
              {pendingOrderData.breakdown && (
                <div className="space-y-1.5 text-xs text-[#6b6661] pb-3 border-b border-stone-100">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{pendingOrderData.breakdown.subtotal}</span>
                  </div>
                  {pendingOrderData.breakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-[#3A6038]">
                      <span>Discount</span>
                      <span>−₹{pendingOrderData.breakdown.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>
                      {pendingOrderData.breakdown.deliveryCharges === 0
                        ? 'FREE'
                        : `₹${pendingOrderData.breakdown.deliveryCharges}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Includes GST</span>
                    <span>₹{pendingOrderData.breakdown.taxAmount}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-baseline">
                <span className="font-bold text-[#2A2A2A]">Amount payable</span>
                <span className="font-black text-2xl text-[#2A2A2A]">₹{pendingOrderData.amount}</span>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-bold">
                  {error}
                </div>
              )}

              <button
                onClick={handleConfirmMockPayment}
                disabled={verifyingPayment}
                data-testid="confirm-payment"
                className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifyingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifyingPayment ? 'Verifying…' : `Pay ₹${pendingOrderData.amount}`}
              </button>

              <button
                onClick={() => setShowMockRazorpay(false)}
                disabled={verifyingPayment}
                className="w-full text-xs text-[#6b6661] hover:text-[#2A2A2A] font-bold py-1 transition disabled:opacity-50"
              >
                Cancel — the order stays unpaid in your account
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
