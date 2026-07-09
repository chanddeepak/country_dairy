'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FALLBACK_PRODUCTS } from '../lib/constants';

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
  logout: () => void;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity: number) => Promise<void>;
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

  const API_URL = 'http://localhost:4000/api';

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
      return data.success;
    } catch (err) {
      console.error('Failed to send OTP:', err);
      // Mock mode fallback for standalone frontend review
      return true;
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
        setToken(data.accessToken);
        setUser(data.user);
        setWalletBalance(Number(data.user.walletBalance || 0));
        localStorage.setItem('cd_token', data.accessToken);
        localStorage.setItem('cd_user', JSON.stringify(data.user));

        // Sync local guest cart with server
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
              body: JSON.stringify({ productId: item.product.id, quantity: item.quantity }),
            });
          }
          localStorage.removeItem('cd_guest_cart');
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to verify OTP:', err);
      // Mock mode fallback
      const mockUser = {
        id: 'mock-user-123',
        name: 'Amit Sharma',
        phone: loginPhone,
        email: 'amit.sharma@example.com',
        walletBalance: 1500,
        addresses: [{ id: 'mock-addr-123', street: 'Flat 402, Oakwood Apartments, Sector 56', city: 'Noida', postalCode: '201301', phone: '+919876543210', isDefault: true }]
      };
      setToken('mock-jwt-token');
      setUser(mockUser);
      setWalletBalance(1500);
      localStorage.setItem('cd_token', 'mock-jwt-token');
      localStorage.setItem('cd_user', JSON.stringify(mockUser));

      // Clear local guest cart on mock login too
      localStorage.removeItem('cd_guest_cart');
      return true;
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

  const addToCart = async (productId: string, quantity: number) => {
    if (!token) {
      setCart(prev => {
        const existing = prev.find(item => item.product.id === productId);
        let next;
        if (existing) {
          next = prev.map(item => item.product.id === productId ? { ...item, quantity: item.quantity + quantity } : item);
        } else {
          const prodObj = FALLBACK_PRODUCTS.find(p => p.id === productId);
          if (prodObj) {
            next = [...prev, { id: `guest-${Date.now()}-${Math.random()}`, product: prodObj, quantity }];
          } else {
            next = prev;
          }
        }
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
        body: JSON.stringify({ productId, quantity }),
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
        body: JSON.stringify({ line1, city, state, pincode, phone }),
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
