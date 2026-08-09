'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FALLBACK_PRODUCTS, API_URL } from '../lib/constants';

interface AppContextType {
  user: any | null;
  token: string | null;
  cart: any[];
  isLoading: boolean;
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
  addToCart: (variantId: string, quantity: number) => Promise<void>;
  updateCartQty: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  checkout: (addressId: string) => Promise<any>;
  verifyPayment: (orderId: string, payId: string) => Promise<boolean>;
  createSubscription: (data: { productId: string; quantity: number; frequency: string; daysOfWeek: number[]; startDate: string }) => Promise<any>;
  addAddress: (line1: string, city: string, state: string, pincode: string, phone: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginPhone, setLoginPhone] = useState<string>('+919876543210');

  // API_URL is imported from constants

  // Attempt to restore token from localStorage on boot
  useEffect(() => {
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

  const fetchCart = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCart(data);
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

  const addToCart = async (variantId: string, quantity: number) => {
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
    try {
      const res = await fetch(`${API_URL}/cart/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // Cart lines reference a variant: price, SKU and stock all live there.
        body: JSON.stringify({ variantId, quantity }),
      });
      if (res.ok) {
        await fetchCart();
      }
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
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
      if (res.ok) {
        await fetchCart();
      }
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
      if (res.ok) {
        await fetchCart();
      }
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

  const addAddress = async (line1: string, city: string, state: string, pincode: string, phone: string) => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/auth/address`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // The API field is postalCode; sending `pincode` fails validation
        // outright now that unknown properties are rejected.
        body: JSON.stringify({ line1, city, state, postalCode: pincode, phone }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const updatedUser = { ...user, addresses: data.addresses };
          setUser(updatedUser);
          localStorage.setItem('cd_user', JSON.stringify(updatedUser));
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to add address:', err);
      // Fallback for mock mode
      const mockAddr = {
        id: `mock-addr-${Date.now()}`,
        street: line1,
        city,
        state,
        postalCode: pincode,
        phone,
        isDefault: false
      };
      const updatedUser = {
        ...user,
        addresses: [...(user.addresses || []), mockAddr]
      };
      setUser(updatedUser);
      localStorage.setItem('cd_user', JSON.stringify(updatedUser));
      return true;
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        cart,
        isLoading,
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
        updateCartQty,
        removeFromCart,
        checkout,
        verifyPayment,
        createSubscription,
        addAddress,
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
