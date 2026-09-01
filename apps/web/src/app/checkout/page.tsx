'use client';

import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, CreditCard, Wallet, ShieldCheck, Plus, CheckCircle2, UserCheck, KeyRound, PhoneCall, AlertCircle, Mail, Lock, User, Loader2 } from 'lucide-react';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { useApp } from '../../context/AppContext';
import StateSelect from '../../components/address/StateSelect';
import { usePincodeLookup } from '../../lib/usePincodeLookup';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useStoreConfig } from '../../context/StoreConfigContext';

export default function CheckoutPage() {
  const router = useRouter();
  const { isFlagOn, isLoading: configLoading } = useStoreConfig();
  const walletEnabled = isFlagOn('ENABLE_WALLET');
  const otpLoginEnabled = isFlagOn('ENABLE_OTP_LOGIN');
  /*
   * Gated on the flag, not on whether someone is signed in.
   *
   * With Cashfree on, nobody sees a checkout page of ours: their window
   * collects the mobile number, the address and the payment, so anything we
   * asked for first would be asked for twice. With the flag off, the page
   * below is still the whole checkout, which is what makes turning it off a
   * rollback rather than an outage.
   */
  const cashfreeCheckout = isFlagOn('ENABLE_CASHFREE_CHECKOUT');
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
  const {
    note: pincodeNote,
    setNote: setPincodeNote,
    check: checkPincode,
    mergeFill,
    markTyped,
  } = usePincodeLookup();

  /**
   * Fill the town and state in from the PIN code.
   *
   * Only what the customer has not already typed is overwritten, so a
   * deliberate correction is not undone by an answer arriving late.
   */
  const onPincodeChange = async (raw: string) => {
    const pincode = raw.replace(/\D/g, '').slice(0, 6);
    setNewAddr((prev) => ({ ...prev, pincode }));

    const filled = await checkPincode(pincode);
    if (!filled) return;

    setNewAddr((prev) => mergeFill(prev, filled));
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
        setAuthError('That code was not right. Check the message, or request a new code.');
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
    /*
     * Cashfree's checkout collects and verifies the address during payment, so
     * with it on nobody needs one first — not a guest, and not a signed-in
     * customer who has never saved one. We still pass whatever we hold, because
     * that prefills their form.
     *
     * With the flag off, our own page is the whole checkout and the address is
     * the one thing it cannot do without.
     */
    if (!cashfreeCheckout && !selectedAddress) {
      setError('Please select a delivery address to proceed.');
      return;
    }
    setError('');
    setProcessing(true);

    try {
      // Flush anything an earlier network blip left unsaved, so the order
      // contains everything the cart showed rather than silently less.
      // Only a signed-in customer has a server cart to reconcile; a guest's
      // lines travel with the checkout request itself.
      const stillFailing = user ? await syncCart() : [];
      if (stillFailing.length > 0) {
        setError(
          `We could not confirm ${stillFailing.join(', ')} with the server. ` +
            'Please check your cart and try again.',
        );
        setProcessing(false);
        return;
      }

      const orderResult = await checkout(selectedAddress || undefined);

      if (!orderResult?.orderId) {
        setError(orderResult?.message || 'Checkout failed. Please try again.');
        return;
      }

      /*
       * Which gateway the server chose, not which one we assume.
       *
       * The flag lives on the server and the credentials veto it, so the
       * browser cannot know the answer before asking — and guessing would open
       * the wrong thing for whoever the flag is off for.
       */
      if (orderResult.provider === 'CASHFREE' && orderResult.paymentSessionId) {
        const cashfree = await loadCashfree({
          mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
        });

        if (!cashfree) {
          setError('The payment window could not be opened. Please try again.');
          return;
        }

        /*
         * The claim token goes in sessionStorage, not the URL.
         *
         * It is a credential — presenting it settles the order and returns a
         * session — so putting it in a query string would write it into browser
         * history and into any Referer this tab later sends. sessionStorage
         * dies with the tab, which is exactly the lifetime it needs.
         */
        if (orderResult.claimToken) {
          sessionStorage.setItem(`cd_claim_${orderResult.orderId}`, orderResult.claimToken);
        }

        // _modal keeps them on this page. The order is already created and its
        // stock already held, so the return page settles it either way — and
        // the webhook settles it independently if the tab is closed.
        await cashfree.checkout({
          paymentSessionId: orderResult.paymentSessionId,
          redirectTarget: '_modal',
        });

        /*
         * Same rule as the cart drawer: only a payment that happened earns a
         * navigation. The return page stays for the redirect flow, where
         * Cashfree brings the customer back rather than the SDK resolving here.
         */
        router.push(`/checkout/cashfree-return?order_id=${orderResult.orderId}`);
        return;
      }

      // Use the server's numbers, not the client's estimate.
      setPendingOrderData({
        orderId: orderResult.orderId,
        orderNumber: orderResult.orderNumber,
        amount: orderResult.breakdown?.totalAmount ?? orderResult.amount ?? total,
        breakdown: orderResult.breakdown,
      });
      setShowMockRazorpay(true);
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

  /*
   * A guest is handed to Cashfree the moment they land here.
   *
   * This page used to answer a logged-out visitor with our own sign-in form,
   * which is the wrong thing twice over: it demands an account before we have
   * given anyone a reason to want one, and Cashfree is about to collect and
   * verify a mobile number anyway. So there is nothing for a guest to fill in
   * here, and nothing to show but the wait.
   *
   * The ref guards React's double-mount in development, which would otherwise
   * place the order twice and hold stock against both.
   */
  const autoStarted = useRef(false);

  // A signed-in customer's saved address is worth waiting a beat for: passing
  // it prefills their Cashfree form. A guest has none, so there is nothing to
  // wait for.
  const addressReady = !user || !user.addresses?.length || Boolean(selectedAddress);

  useEffect(() => {
    if (!cashfreeCheckout || cart.length === 0 || !addressReady || autoStarted.current) return;
    autoStarted.current = true;
    void handlePlaceOrder();
    // handlePlaceOrder is rebuilt every render; the ref is what makes this run
    // once, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashfreeCheckout, cart.length, addressReady]);

  /*
   * Nothing is decided until the flags arrive.
   *
   * They are fetched, so the first render has an empty map and every isFlagOn
   * reads false — which would render the old page, and for a logged-out visitor
   * that is the sign-in block, exactly the thing this page is meant never to
   * show again. It settles a moment later, but a flash of "please sign in" on
   * the way to paying is its own bug, and if the request is slow or fails it is
   * not a flash at all.
   */
  if (configLoading || cashfreeCheckout) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar onCartOpen={() => {}} onAuthOpen={() => {}} />
        <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center bg-[var(--ivory)] px-4 py-24">
          <div className="w-full max-w-md text-center">
            {error ? (
              <>
                <AlertCircle className="mx-auto mb-6 h-8 w-8 text-[var(--danger)]" />
                <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                  We couldn&rsquo;t open the payment window
                </h1>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-8 inline-flex items-center rounded-sm bg-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ivory)] transition-colors hover:bg-[var(--pine)]"
                >
                  Back to shopping
                </button>
              </>
            ) : cart.length === 0 && !configLoading ? (
              <>
                <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                  Your cart is empty
                </h1>
                <button
                  onClick={() => router.push('/')}
                  className="mt-8 inline-flex items-center rounded-sm bg-[var(--forest)] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ivory)] transition-colors hover:bg-[var(--pine)]"
                >
                  Start shopping
                </button>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto mb-6 h-8 w-8 animate-spin text-[var(--forest)]" />
                <h1 className="font-serif text-[26px] font-light text-[var(--ink)]">
                  {configLoading ? 'Preparing your order' : 'Opening secure payment'}
                </h1>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
                  {configLoading
                    ? 'One moment.'
                    : 'This takes a few seconds. You\u2019ll confirm your mobile number and delivery address in the payment window.'}
                </p>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => {}} onAuthOpen={() => {}} />

      <main className="flex-1 bg-[var(--ivory)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-serif font-light text-3xl text-[var(--ink)] mb-8">Checkout</h1>

          {/* Guest Checkout - Ask for login first */}
          {!user ? (
            <div className="bg-white border border-[var(--line)] rounded-sm p-8 max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-[rgb(var(--forest-rgb)/0.1)] text-[var(--forest)] rounded-full flex items-center justify-center mx-auto mb-6">
                <UserCheck className="h-8 w-8" />
              </div>
              <h2 className="font-serif font-light text-2xl text-[var(--ink)] mb-2">Secure Checkout</h2>
              <p className="text-xs text-[var(--ink-soft)] mb-6">
                Sign in to use your saved addresses and to track this order.
              </p>

              {authError && (
                <div className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger)] p-3 rounded-sm text-xs font-bold mb-4 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {authError}
                </div>
              )}

              {/* Email and password is the live sign-in path. OTP only appears
                  when ENABLE_OTP_LOGIN is on, and it needs an SMS provider. */}
              <form onSubmit={handleGuestEmailAuth} className="space-y-4 text-left">
                {isRegistering && (
                  <div>
                    <label className="text-xs font-bold text-[var(--ink)] block mb-1">Your Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full bg-[var(--ivory)] border border-[var(--line)] pl-10 pr-4 py-3 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[var(--ink)] block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[var(--ivory)] border border-[var(--line)] pl-10 pr-4 py-3 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--ink)] block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={isRegistering ? 'At least 8 characters' : '••••••••'}
                      className="w-full bg-[var(--ivory)] border border-[var(--line)] pl-10 pr-4 py-3 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3.5 rounded-sm text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full text-xs text-[var(--ink-soft)] hover:text-[var(--forest)] font-bold transition"
                >
                  {isRegistering
                    ? 'Already have an account? Sign in'
                    : "New here? Create an account"}
                </button>
              </form>

              {otpLoginEnabled && (
                <div className="mt-6 pt-5 border-t border-[var(--line)] text-left">
                  {!otpSent ? (
                    <form onSubmit={handleGuestRequestOtp} className="space-y-3">
                      <label className="text-xs font-bold text-[var(--ink)] block">Or sign in with your mobile</label>
                      <div className="relative">
                        <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
                        <input
                          type="tel"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder="+919876543210"
                          className="w-full bg-[var(--ivory)] border border-[var(--line)] pl-10 pr-4 py-3 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full border-2 border-[var(--forest)] text-[var(--forest)] font-bold py-3 rounded-sm text-sm transition disabled:opacity-50"
                      >
                        {authLoading ? 'Sending…' : 'Request OTP'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleGuestVerifyOtp} className="space-y-3">
                      <label className="text-xs font-bold text-[var(--ink)] block">Verification Code</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-soft)]" />
                        <input
                          type="text"
                          value={authOtp}
                          onChange={(e) => setAuthOtp(e.target.value)}
                          maxLength={6}
                          className="w-full bg-[var(--ivory)] border border-[var(--line)] pl-10 pr-4 py-3 rounded-sm text-sm tracking-[0.3em] font-black focus:outline-none focus:border-[var(--forest)]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-[var(--forest)] text-white font-bold py-3 rounded-sm text-sm transition disabled:opacity-50"
                      >
                        {authLoading ? 'Verifying…' : 'Verify & Continue'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : cart.length === 0 && !processing ? (
            <div className="text-center py-20 bg-white border border-[var(--line)] rounded-sm">
              <p className="text-lg font-bold text-[var(--ink-soft)] mb-4">Your cart is empty</p>
              <button
                onClick={() => router.push('/')}
                className="bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3 px-8 rounded-sm transition"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger)] p-4 rounded-sm text-sm font-bold mb-6">
                  {error}
                </div>
              )}

              {unsyncedCount > 0 && !error && (
                <div className="bg-[var(--warn-bg)] border border-[var(--warn-line)] text-[var(--warn)] p-4 rounded-sm text-xs font-medium mb-6">
                  {unsyncedCount} item{unsyncedCount === 1 ? '' : 's'} in your cart could not be
                  saved earlier. We will confirm {unsyncedCount === 1 ? 'it' : 'them'} when you
                  place the order.
                </div>
              )}

              {/* Step 1: Delivery Address */}
              <div className="bg-white border border-[var(--line)] rounded-sm p-6 mb-6">
                <h2 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-[var(--forest)]" />
                  STEP 1: DELIVERY ADDRESS
                </h2>
                
                <div className="space-y-4">
                  {/* List existing addresses */}
                  {addresses.length > 0 && (
                    <div className="grid grid-cols-1 gap-3">
                      {addresses.map((addr: any) => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3.5 p-4 rounded-sm border cursor-pointer transition ${
                            selectedAddress === addr.id
                              ? 'border-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.05)]'
                              : 'border-[var(--line)] hover:border-[var(--line)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            checked={selectedAddress === addr.id}
                            onChange={() => { setSelectedAddress(addr.id); setShowNewAddr(false); }}
                            className="accent-[var(--forest)] mt-1 shrink-0"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[var(--ink)]">{addr.line1}, {addr.city}</span>
                              {addr.isDefault && (
                                <span className="text-[9px] font-bold text-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.1)] px-2 py-0.5 rounded-full">DEFAULT</span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--ink-soft)]">{addr.state} - {addr.postalCode}</p>
                            {addr.phone && (
                              <p className="text-xs text-[var(--forest)] font-bold">Contact {addr.phone}</p>
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
                      className="flex items-center gap-2 text-xs font-bold text-[var(--forest)] hover:underline px-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add New Address
                    </button>
                  ) : (
                    <form onSubmit={handleSaveAddress} data-testid="address-form" className="border border-[var(--line)] p-5 rounded-sm bg-[rgb(var(--cream-rgb)/0.5)] space-y-3.5">
                      <h3 className="text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">Add Delivery Address</h3>
                      {addrError && (
                        <div className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger)] p-2.5 rounded-sm text-xs font-bold">
                          {addrError}
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Street / Apartment Address"
                          value={newAddr.line1}
                          onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
                          className="w-full bg-white border border-[var(--line)] px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
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
                            className="bg-white border border-[var(--line)] px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                          />
                          <input
                            type="text"
                            placeholder="City"
                            data-testid="address-city"
                            value={newAddr.city}
                            onChange={(e) => {
                              markTyped('city');
                              setNewAddr({ ...newAddr, city: e.target.value });
                            }}
                            className="bg-white border border-[var(--line)] px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                          />
                          {/* A list rather than free text: the courier
                              matches on this, and GST turns on whether the
                              supply crossed a state line. "UK" and
                              "Uttrakhand" for the same place are not
                              harmless. */}
                          <StateSelect
                            testId="address-state"
                            value={newAddr.state}
                            onChange={(state) => {
                              markTyped('state');
                              setNewAddr({ ...newAddr, state });
                            }}
                            className="bg-white border border-[var(--line)] px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                          />
                        </div>

                        {pincodeNote && (
                          <p
                            data-testid="pincode-note"
                            className={`text-[11px] ${
                              pincodeNote.ok ? 'text-[var(--forest)]' : 'text-[var(--warn)]'
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
                          className="w-full bg-white border border-[var(--line)] px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-[var(--forest)]"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => { setShowNewAddr(false); setAddrError(''); }}
                          className="text-xs font-bold text-[var(--ink-soft)] hover:bg-[var(--cream)] px-3.5 py-2 rounded-sm transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addrSaving}
                          className="bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold text-xs px-4 py-2 rounded-sm transition disabled:opacity-50"
                        >
                          {addrSaving ? 'Saving...' : 'Save & Continue'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Step 2: Order Summary */}
              <div className="bg-white border border-[var(--line)] rounded-sm p-6 mb-6">
                <h2 className="font-bold text-sm text-[var(--ink)] mb-4">STEP 2: ORDER SUMMARY</h2>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                      <span className="text-[var(--ink-soft)] min-w-0">
                        {item.productSlug ? (
                          <Link
                            href={`/products/${item.productSlug}${item.variantId ? `?variant=${item.variantId}` : ''}`}
                            className="font-bold text-[var(--ink)] hover:text-[var(--forest)] hover:underline transition"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          <span className="font-bold text-[var(--ink)]">{item.productName}</span>
                        )}
                        {item.variantLabel ? ` (${item.variantLabel})` : ''} × {item.quantity}
                      </span>
                      <span className="font-bold text-[var(--ink)] whitespace-nowrap">
                        ₹{item.lineTotal}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--line)] pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--ink-soft)]">Subtotal</span>
                      <span className="font-bold">₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--ink-soft)]">Delivery</span>
                      <span className={estimatedDelivery === 0 ? 'font-bold text-[var(--forest)]' : 'font-bold'}>
                        {estimatedDelivery === 0 ? 'FREE' : `₹${estimatedDelivery}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-black pt-2 border-t border-[var(--line)]">
                      <span>TOTAL</span>
                      <span>₹{total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Payment Method */}
              <div className="bg-white border border-[var(--line)] rounded-sm p-6 mb-6">
                <h2 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4 text-[var(--forest)]" />
                  STEP 3: PAYMENT METHOD
                </h2>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-4 rounded-sm border cursor-pointer transition ${
                    paymentMethod === 'razorpay' ? 'border-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.05)]' : 'border-[var(--line)] hover:border-[var(--line)]'
                  }`}>
                    <input type="radio" name="payment" checked={paymentMethod === 'razorpay'}
                      onChange={() => setPaymentMethod('razorpay')} className="accent-[var(--forest)]" />
                    <div>
                      <span className="text-sm font-bold text-[var(--ink)]">Pay via Razorpay</span>
                      <span className="text-xs text-[var(--ink-soft)] block">UPI / Card / Netbanking</span>
                    </div>
                  </label>
                  {walletEnabled && (
                  <label className={`flex items-center gap-3 p-4 rounded-sm border cursor-pointer transition ${
                    paymentMethod === 'wallet' ? 'border-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.05)]' : 'border-[var(--line)] hover:border-[var(--line)]'
                  }`}>
                    <input type="radio" name="payment" checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')} className="accent-[var(--forest)]" />
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-[var(--brass-text)]" />
                      <span className="text-sm font-bold text-[var(--ink)]">Pay from Wallet</span>
                      <span className="text-xs text-[var(--ink-soft)]">(Balance: ₹{walletBalance})</span>
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
                className="w-full bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-4 rounded-sm text-lg transition disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                {processing ? 'Processing Order...' : `Place Order — ₹${total}`}
              </button>

              <p className="flex items-center justify-center gap-1 text-xs text-[var(--ink-soft)] mt-4">
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
        <div className="fixed inset-0 z-50 bg-[rgb(var(--ink-rgb)/0.7)] backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-[var(--forest)] text-white p-5">
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
                <div className="space-y-1.5 text-xs text-[var(--ink-soft)] pb-3 border-b border-[var(--line)]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{pendingOrderData.breakdown.subtotal}</span>
                  </div>
                  {pendingOrderData.breakdown.discountAmount > 0 && (
                    <div className="flex justify-between text-[var(--forest)]">
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
                <span className="font-bold text-[var(--ink)]">Amount payable</span>
                <span className="font-black text-2xl text-[var(--ink)]">₹{pendingOrderData.amount}</span>
              </div>

              {error && (
                <div className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger)] p-2.5 rounded-sm text-xs font-bold">
                  {error}
                </div>
              )}

              <button
                onClick={handleConfirmMockPayment}
                disabled={verifyingPayment}
                data-testid="confirm-payment"
                className="w-full bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3.5 rounded-sm text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifyingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifyingPayment ? 'Verifying…' : `Pay ₹${pendingOrderData.amount}`}
              </button>

              <button
                onClick={() => setShowMockRazorpay(false)}
                disabled={verifyingPayment}
                className="w-full text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] font-bold py-1 transition disabled:opacity-50"
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
