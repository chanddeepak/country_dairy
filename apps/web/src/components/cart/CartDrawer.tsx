'use client';

import React from 'react';
import { X, ShoppingBag, Minus, Plus, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ENABLE_WEBSITE_PAYMENT, WHATSAPP_NUMBER } from '../../lib/constants';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ isOpen, onClose, onCheckout }: CartDrawerProps) {
  const { cart, updateCartQty, removeFromCart } = useApp();

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md shadow-2xl relative flex flex-col h-full animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-stone-100">
          <h3 className="font-serif font-black text-xl text-[#2A2A2A]">Shopping Cart</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <ShoppingBag className="h-12 w-12 text-stone-200 mx-auto" />
              <p className="text-sm font-bold text-stone-400">Your cart is empty</p>
              <button onClick={onClose} className="text-xs text-[#3A6038] font-bold hover:underline">
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-start gap-4 pb-5 border-b border-stone-100 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-[#2A2A2A] text-sm leading-snug">{item.product.name}</h4>
                    <span className="text-xs text-[#6b6661]">₹{item.product.price} each</span>

                    <div className="flex items-center space-x-3 mt-2">
                      <button
                        onClick={() => updateCartQty(item.id, item.quantity - 1)}
                        className="p-0.5 border border-stone-300 rounded hover:bg-stone-50 transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-black text-[#2A2A2A] w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(item.id, item.quantity + 1)}
                        className="p-0.5 border border-stone-300 rounded hover:bg-stone-50 transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-[#3A6038] text-sm">₹{Number(item.product.price) * item.quantity}</span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="block text-red-500 hover:text-red-700 mt-1 text-[11px] font-bold transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Checkout */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-stone-100 bg-white">
            <div className="flex justify-between mb-1 text-sm text-[#6b6661]">
              <span>Subtotal:</span>
              <span className="font-bold">₹{subtotal}</span>
            </div>
            <div className="flex justify-between mb-1 text-sm text-[#6b6661]">
              <span>Shipping:</span>
              <span className="text-[#3A6038] font-bold">FREE</span>
            </div>
            <div className="flex justify-between mb-6 text-lg font-black text-[#2A2A2A]">
              <span>Total:</span>
              <span>₹{subtotal}</span>
            </div>
            {ENABLE_WEBSITE_PAYMENT ? (
              <button
                onClick={onCheckout}
                className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl transition"
              >
                Checkout Now
              </button>
            ) : (
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  `Hi! I'd like to order the following items:\n${cart.map(i => `📦 ${i.product.name} × ${i.quantity} — ₹${Number(i.product.price) * i.quantity}`).join('\n')}\n💰 Total: ₹${subtotal}\n\nPlease help me place this order. Thank you!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="w-full flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-xl transition"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Complete Order on WhatsApp
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full text-center text-xs text-[#6b6661] hover:text-[#2A2A2A] font-bold mt-3 transition"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
