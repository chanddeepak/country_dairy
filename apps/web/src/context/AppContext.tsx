'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

/** Carries the HTTP status so callers can tell a rejection from an outage. */
class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
import { FALLBACK_PRODUCTS, API_URL } from '../lib/constants';

/** Why an address write failed, so the page can say something true. */
export interface AddressResult {
  ok: boolean;
  error?: string;
  /** The session was rejected; the customer has been signed out. */
  signedOut?: boolean;
}

interface AppContextType {
  user: any | null;
  token: string | null;
  cart: any[];
  isLoading: boolean;
  /** False until localStorage has been read. Guard auth checks on this. */
  isSessionReady: boolean;
  walletBalance: number;
  loginPhone: string;
  setLoginPhone: (phone: string) => void;
  sendOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
  loginWithEmail: (email: string, pass: string) => Promise<boolean>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  logout: () => void;
  fetchCart: () => Promise<void>;
  /**
   * `optimistic` lets the caller pass what it already knows about the line so
   * the cart updates instantly, before the server replies.
   */
  addToCart: (
    variantId: string,
    quantity: number,
    optimistic?: {
      productId?: string;
      productName: string;
      variantLabel?: string;
      unitPrice: number;
      imageUrl?: string;
    },
  ) => Promise<void>;
  /** Variant id currently being added, so buttons can show a pending state. */
  pendingCartVariantId: string | null;
  /** Surfaced so a rejected add (out of stock) is not swallowed. */
  cartError: string;
  /**
   * Lines the server never accepted because of a transient failure. Flushed
   * by syncCart before checkout so a shopper is not charged for less than the
   * cart showed them.
   */
  unsyncedCount: number;
  /** Retries anything unsynced. Resolves to the lines still not accepted. */
  syncCart: () => Promise<string[]>;
  /** Set briefly after a successful add, to confirm it landed. */
  lastAddedVariantId: string | null;
  updateCartQty: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  checkout: (addressId: string) => Promise<any>;
  verifyPayment: (orderId: string, payId: string) => Promise<boolean>;
  createSubscription: (data: { productId: string; quantity: number; frequency: string; daysOfWeek: number[]; startDate: string }) => Promise<any>;
  addAddress: (
    line1: string,
    city: string,
    state: string,
    pincode: string,
    phone: string,
    line2?: string,
  ) => Promise<AddressResult>;
  updateAddress: (id: string, patch: Record<string, unknown>) => Promise<AddressResult>;
  deleteAddress: (id: string) => Promise<AddressResult>;
  updateProfile: (patch: { name?: string; phone?: string }) => Promise<AddressResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AddressResult>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSessionReady, setIsSessionReady] = useState<boolean>(false);
  const [loginPhone, setLoginPhone] = useState<string>('+919876543210');
  const [pendingCartVariantId, setPendingCartVariantId] = useState<string | null>(null);
  const [lastAddedVariantId, setLastAddedVariantId] = useState<string | null>(null);
  const [cartError, setCartError] = useState('');
  const unsyncedRef = useRef<Map<string, { quantity: number; name: string }>>(new Map());
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // API_URL is imported from constants

  // Attempt to restore token from localStorage on boot.
  //
  // isSessionReady exists because this runs *after* the first render, so a
  // page guarding on `!user` saw null and flashed a sign-in modal at a
  // customer who was already signed in.
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('cd_token');
      const savedUser = localStorage.getItem('cd_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setWalletBalance(Number(parsedUser.walletBalance || 0));
      } else {
        const guestCart = localStorage.getItem('cd_guest_cart');
        if (guestCart) {
          setCart(JSON.parse(guestCart));
        }
      }
    } catch {
      // Corrupt localStorage should sign the customer out, not white-screen
      // the whole storefront on a JSON.parse throw.
      localStorage.removeItem('cd_token');
      localStorage.removeItem('cd_user');
    } finally {
      setIsSessionReady(true);
    }
  }, []);

  // Fetch cart once token changes
  useEffect(() => {
    if (token) {
      fetchCart();
    } else {
      const guestCart = localStorage.getItem('cd_guest_cart');
      if (guestCart) {
        setCart(JSON.parse(guestCart));
      } else {
        setCart([]);
      }
    }
  }, [token]);

  const sendOtp = async (phone: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      return res.ok && data.success === true;
    } catch (err) {
      console.error('Failed to send OTP:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (otp: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, otp }),
      });
      const data = await res.json();
      if (data.accessToken) {
        await handleAuthSuccess(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to verify OTP:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async (data: any) => {
    setToken(data.accessToken);
    setUser(data.user);
    setWalletBalance(Number(data.user.walletBalance || 0));
    localStorage.setItem('cd_token', data.accessToken);
    localStorage.setItem('cd_user', JSON.stringify(data.user));

    const guestCartStr = localStorage.getItem('cd_guest_cart');
    if (guestCartStr) {
      const guestCart = JSON.parse(guestCartStr);
      for (const item of guestCart) {
        await fetch(`${API_URL}/cart/add`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ variantId: item.variantId ?? item.product.id, quantity: item.quantity }),
        });
      }
      localStorage.removeItem('cd_guest_cart');
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/email/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        await handleAuthSuccess(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to login with email:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/email/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, name }),
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        await handleAuthSuccess(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to register with email:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        await handleAuthSuccess(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to login with google:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setCart([]);
    setWalletBalance(0);
    localStorage.removeItem('cd_token');
    localStorage.removeItem('cd_user');
    localStorage.removeItem('cd_guest_cart');
  };

  /**
   * One shape for cart lines, whatever their source.
   *
   * The API returns product.title and a computed unitPrice; the guest cart
   * built product.name and product.price. The drawer read the guest shape, so
   * a signed-in cart rendered "₹NaN" with no product name.
   */
  const normalizeCartItem = (item: any) => {
    const unitPrice = Number(item.unitPrice ?? item.product?.price ?? 0);
    const quantity = Number(item.quantity ?? 1);

    return {
      id: item.id,
      variantId: item.variantId ?? item.variant?.id,
      productId: item.productId ?? item.product?.id,
      productName: item.product?.title ?? item.product?.name ?? 'Product',
      productSlug: item.product?.slug,
      variantLabel: item.variant?.sizeLabel ?? item.variant?.volumeOrWeight ?? '',
      imageUrl:
        item.variant?.imageUrl ??
        item.product?.galleryImages?.find((g: any) => g.isPrimary)?.imageUrl ??
        item.product?.galleryImages?.[0]?.imageUrl ??
        item.product?.imageUrls?.[0],
      unitPrice,
      quantity,
      lineTotal: Number(item.lineTotal ?? unitPrice * quantity),
      availableStock: item.availableStock,
      isAvailable: item.isAvailable ?? true,
      // Kept so existing consumers that reach into product still work.
      product: item.product,
    };
  };

  const fetchCart = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCart(data.map(normalizeCartItem));
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  };

  /**
   * Resolves a variant from the live catalog so a guest cart shows real
   * prices. Reading them from the static fallback catalogue would show one
   * price in the drawer and charge another at checkout.
   */
  const resolveVariant = async (variantId: string) => {
    try {
      const res = await fetch(`${API_URL}/catalog/products`);
      if (!res.ok) return null;
      const products = await res.json();

      for (const product of products) {
        const variant = (product.variants || []).find((v: any) => v.id === variantId);
        if (variant) return { product, variant };
      }
    } catch (err) {
      console.error('Failed to resolve variant for guest cart:', err);
    }
    return null;
  };

  const addToCart: AppContextType['addToCart'] = async (variantId, quantity, optimistic) => {
    setPendingCartVariantId(variantId);
    setCartError('');

    // Apply the change locally first. A round trip to the database region is
    // ~700ms, so waiting for it makes the button feel dead; the server result
    // reconciles the list a moment later.
    const snapshot = cart;
    if (optimistic) {
      setCart((prev) => {
        const existing = prev.find((i) => i.variantId === variantId);
        if (existing) {
          return prev.map((i) =>
            i.variantId === variantId
              ? { ...i, quantity: i.quantity + quantity, lineTotal: i.unitPrice * (i.quantity + quantity) }
              : i,
          );
        }
        return [
          ...prev,
          {
            id: `pending-${variantId}`,
            variantId,
            productId: optimistic.productId,
            productName: optimistic.productName,
            variantLabel: optimistic.variantLabel ?? '',
            imageUrl: optimistic.imageUrl,
            unitPrice: optimistic.unitPrice,
            quantity,
            lineTotal: optimistic.unitPrice * quantity,
            isAvailable: true,
            product: undefined,
          },
        ];
      });
      // The tick shows immediately; the request continues behind it.
      setLastAddedVariantId(variantId);
      setTimeout(() => setLastAddedVariantId((id) => (id === variantId ? null : id)), 2000);
    }

    try {
      await addToCartInner(variantId, quantity);
      unsyncedRef.current.delete(variantId);
      setUnsyncedCount(unsyncedRef.current.size);
      if (!optimistic) {
        setLastAddedVariantId(variantId);
        setTimeout(() => setLastAddedVariantId((id) => (id === variantId ? null : id)), 2000);
      }
    } catch (err) {
      const transient = isTransient(err);

      if (transient && optimistic) {
        // Keep the optimistic line and remember to retry it at checkout: the
        // server may simply have been unreachable for a moment.
        unsyncedRef.current.set(variantId, {
          quantity,
          name: optimistic.productName,
        });
        setUnsyncedCount(unsyncedRef.current.size);
        setCartError('Saved locally — we will confirm this at checkout.');
      } else {
        // A considered rejection (out of stock): roll back so the cart never
        // shows something the server refused.
        if (optimistic) setCart(snapshot);
        setLastAddedVariantId(null);
        setCartError(err instanceof Error ? err.message : 'Could not add this item');
      }

      setTimeout(() => setCartError(''), 4000);
    } finally {
      setPendingCartVariantId(null);
    }
  };

  /**
   * A 4xx is the server's considered answer — out of stock, not purchasable —
   * and must not be retried. Only network failures and 5xx are worth another
   * attempt.
   */
  const isTransient = (err: unknown) =>
    err instanceof TypeError || (err instanceof HttpError && err.status >= 500);

  const postCartAdd = async (variantId: string, quantity: number, attempt = 0): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/cart/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variantId, quantity }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new HttpError(res.status, body?.message || 'Could not add this item to your cart');
      }

      const updated = await res.json();
      if (Array.isArray(updated)) {
        setCart(updated.map(normalizeCartItem));
      } else {
        await fetchCart();
      }
    } catch (err) {
      if (isTransient(err) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return postCartAdd(variantId, quantity, attempt + 1);
      }
      throw err;
    }
  };

  const addToCartInner = async (variantId: string, quantity: number) => {
    if (!token) {
      const resolved = await resolveVariant(variantId);
      if (!resolved) return;

      const { product, variant } = resolved;

      setCart(prev => {
        const existing = prev.find(item => item.variantId === variantId);
        const next = existing
          ? prev.map(item =>
              item.variantId === variantId
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            )
          : [
              ...prev,
              {
                id: `guest-${Date.now()}-${Math.random()}`,
                variantId,
                product: {
                  ...product,
                  name: product.title ?? product.name,
                  price: String(variant.sellingPrice),
                },
                variant: { id: variant.id, sizeLabel: variant.sizeLabel },
                quantity,
              },
            ];

        localStorage.setItem('cd_guest_cart', JSON.stringify(next));
        return next;
      });
      return;
    }
    // Cart lines reference a variant: price, SKU and stock all live there.
    await postCartAdd(variantId, quantity);
  };

  /**
   * Retries lines a transient failure left unsaved. Called before checkout so
   * a shopper is never charged for less than the cart showed them.
   * Returns the names of any line still not accepted.
   */
  const syncCart = async (): Promise<string[]> => {
    if (!token || unsyncedRef.current.size === 0) return [];

    const stillFailing: string[] = [];

    for (const [variantId, entry] of Array.from(unsyncedRef.current.entries())) {
      try {
        await postCartAdd(variantId, entry.quantity);
        unsyncedRef.current.delete(variantId);
      } catch {
        stillFailing.push(entry.name);
      }
    }

    setUnsyncedCount(unsyncedRef.current.size);
    return stillFailing;
  };

  const applyCartResponse = async (res: Response) => {
    if (!res.ok) return;
    const updated = await res.json().catch(() => null);
    if (Array.isArray(updated)) setCart(updated.map(normalizeCartItem));
  };

  const updateCartQty = async (itemId: string, quantity: number) => {
    if (!token) {
      setCart(prev => {
        const next = prev.map(item => item.id === itemId ? { ...item, quantity } : item).filter(item => item.quantity > 0);
        localStorage.setItem('cd_guest_cart', JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/cart/update`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, quantity }),
      });
      await applyCartResponse(res);
    } catch (err) {
      console.error('Failed to update cart qty:', err);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!token) {
      setCart(prev => {
        const next = prev.filter(item => item.id !== itemId);
        localStorage.setItem('cd_guest_cart', JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/cart/remove/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await applyCartResponse(res);
    } catch (err) {
      console.error('Failed to remove from cart:', err);
    }
  };

  const checkout = async (addressId: string) => {
    if (!token) throw new Error('Not authenticated');
    try {
      const res = await fetch(`${API_URL}/orders/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addressId, deliveryType: 'LOCAL' }),
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to checkout:', err);
      return null;
    }
  };

  const verifyPayment = async (orderId: string, payId: string) => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/orders/verify-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          razorpayPaymentId: payId,
          signature: 'sig_mock_signature',
        }),
      });
      if (res.ok) {
        await fetchCart();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to verify payment:', err);
      return false;
    }
  };

  const createSubscription = async (subData: any) => {
    if (!token) throw new Error('Not authenticated');
    try {
      const res = await fetch(`${API_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subData),
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to create subscription:', err);
      return null;
    }
  };

  const updateProfile = async (patch: {
    name?: string;
    phone?: string;
  }): Promise<AddressResult> => {
    if (!token) return { ok: false, error: 'Please sign in first.', signedOut: true };

    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });

      if (res.ok) {
        const data = await res.json();
        // Keep the addresses already held — /auth/me returns them, but a
        // narrower response must not blank the address book.
        const updatedUser = { ...user, ...data.user, addresses: data.user?.addresses ?? user?.addresses };
        setUser(updatedUser);
        localStorage.setItem('cd_user', JSON.stringify(updatedUser));
        return { ok: true };
      }

      if (res.status === 401) {
        logout();
        return { ok: false, error: 'Your session has expired. Please sign in again.', signedOut: true };
      }

      const body = await res.json().catch(() => null);
      const message = Array.isArray(body?.message)
        ? body.message.join('. ')
        : body?.message || 'Could not update your profile.';
      return { ok: false, error: message };
    } catch (err) {
      console.error('Failed to update profile:', err);
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<AddressResult> => {
    if (!token) return { ok: false, error: 'Please sign in first.', signedOut: true };

    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) return { ok: true };

      const body = await res.json().catch(() => null);
      const message = Array.isArray(body?.message)
        ? body.message.join('. ')
        : body?.message || 'Could not change your password.';

      // A 401 here means the *current password* was wrong, not that the
      // session expired, so this must not sign the customer out.
      return { ok: false, error: message };
    } catch (err) {
      console.error('Failed to change password:', err);
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  /** Persists the returned address list to state and localStorage. */
  const applyAddresses = (addresses: unknown[]) => {
    const updatedUser = { ...user, addresses };
    setUser(updatedUser);
    localStorage.setItem('cd_user', JSON.stringify(updatedUser));
  };

  /**
   * One place to turn an address response into a result the UI can explain.
   *
   * These used to return a bare boolean, so the page could only ever say
   * "check the details and try again" — including when the details were
   * perfect and the real problem was an expired session. The API's own
   * validation message is far more useful than anything invented here.
   */
  const handleAddressResponse = async (res: Response): Promise<AddressResult> => {
    if (res.ok) {
      const data = await res.json();
      if (!data?.success) return { ok: false, error: 'The server rejected that change.' };

      applyAddresses(data.addresses);
      return { ok: true };
    }

    // An expired or rotated token is not a data problem, and telling the
    // customer to check their PIN code sends them looking in the wrong place.
    if (res.status === 401) {
      logout();
      return { ok: false, error: 'Your session has expired. Please sign in again.', signedOut: true };
    }

    let message = 'Could not save that address.';
    try {
      const body = await res.json();
      // Nest returns a string or an array of validation messages.
      if (Array.isArray(body?.message)) message = body.message.join('. ');
      else if (typeof body?.message === 'string') message = body.message;
    } catch {
      // Keep the default when the body is not JSON.
    }

    return { ok: false, error: message };
  };

  const addAddress = async (
    line1: string,
    city: string,
    state: string,
    pincode: string,
    phone: string,
    line2?: string,
  ): Promise<AddressResult> => {
    if (!token) return { ok: false, error: 'Please sign in to save an address.', signedOut: true };

    try {
      const res = await fetch(`${API_URL}/auth/address`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // The API field is postalCode; sending `pincode` fails validation
        // outright now that unknown properties are rejected.
        body: JSON.stringify({ line1, line2: line2 || undefined, city, state, postalCode: pincode, phone }),
      });

      return await handleAddressResponse(res);
    } catch (err) {
      // Deliberately no fallback. This used to synthesise a local address and
      // report success, so a failed save looked like it worked — the customer
      // saw an address that existed only in their browser.
      console.error('Failed to add address:', err);
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  const updateAddress = async (
    id: string,
    patch: Record<string, unknown>,
  ): Promise<AddressResult> => {
    if (!token) return { ok: false, error: 'Please sign in first.', signedOut: true };

    try {
      const res = await fetch(`${API_URL}/auth/address/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });

      return await handleAddressResponse(res);
    } catch (err) {
      console.error('Failed to update address:', err);
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  const deleteAddress = async (id: string): Promise<AddressResult> => {
    if (!token) return { ok: false, error: 'Please sign in first.', signedOut: true };

    try {
      const res = await fetch(`${API_URL}/auth/address/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      return await handleAddressResponse(res);
    } catch (err) {
      console.error('Failed to delete address:', err);
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        cart,
        isLoading,
        isSessionReady,
        walletBalance,
        loginPhone,
        setLoginPhone,
        sendOtp,
        verifyOtp,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        fetchCart,
        addToCart,
        pendingCartVariantId,
        lastAddedVariantId,
        cartError,
        unsyncedCount,
        syncCart,
        updateCartQty,
        removeFromCart,
        checkout,
        verifyPayment,
        createSubscription,
        addAddress,
        updateAddress,
        deleteAddress,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
