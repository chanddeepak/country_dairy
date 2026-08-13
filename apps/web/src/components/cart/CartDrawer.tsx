'use client';

import Link from 'next/link';
import React from 'react';
import { X, ShoppingBag, Minus, Plus, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useStoreConfig } from '../../context/StoreConfigContext';
import { resolveStorefrontImageUrl } from '../../lib/constants';
import { buildCartMessage, whatsAppUrl } from '../../lib/storeConfig';
import { trackStorefrontEvent } from '../../lib/analytics';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ isOpen, onClose, onCheckout }: CartDrawerProps) {
  // Every hook must run before the early return below, otherwise the hook
  // count differs between the open and closed renders and React errors.
  const { cart, updateCartQty, removeFromCart } = useApp();
  const { whatsapp, isFlagOn } = useStoreConfig();

  if (!isOpen) return null;

  // Uses the normalised line total from AppContext. Reading product.price
  // here produced "₹NaN" for a signed-in cart, whose API shape has no such
  // field.
  const subtotal = cart.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
  const checkoutEnabled = isFlagOn('ENABLE_CART');

  // Mirrors the server's rule. "FREE" was hardcoded, so a small basket showed
  // free shipping in the drawer and was charged ₹40 at checkout.
  const FREE_DELIVERY_THRESHOLD = 500;
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : 40;

  // The whole cart as one message. This is the most valuable placement for
  // WhatsApp ordering — it catches a shopper who is about to abandon.
  const whatsappHref = whatsapp?.isEnabled
    ? whatsAppUrl(
        whatsapp,
        buildCartMessage(
          whatsapp,
          cart.map((i) => ({
            productName: i.productName,
            variantLabel: i.variantLabel,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice) || 0,
          })),
        ),
      )
    : null;

  const handleWhatsAppOrder = () => {
    trackStorefrontEvent({ eventName: 'whatsapp_order_click' });
    onClose();
  };

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
                  {item.imageUrl && (
                    <div className="w-16 h-16 rounded-lg bg-[#FAF8F3] border border-stone-200 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveStorefrontImageUrl(item.imageUrl)}
                        alt={item.productName}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Back to the exact size in the cart, not just the
                        product — the variant is what carries size and price. */}
                    {item.productSlug ? (
                      <Link
                        href={`/products/${item.productSlug}${item.variantId ? `?variant=${item.variantId}` : ''}`}
                        onClick={onClose}
                        className="font-bold text-[#2A2A2A] hover:text-[#3A6038] hover:underline text-sm leading-snug block transition"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <h4 className="font-bold text-[#2A2A2A] text-sm leading-snug">
                        {item.productName}
                      </h4>
                    )}
                    {item.variantLabel && (
                      <div className="text-[11px] text-[#6b6661]">{item.variantLabel}</div>
                    )}
                    <span className="text-xs text-[#6b6661]">₹{item.unitPrice} each</span>

                    {item.isAvailable === false && (
                      <div className="text-[11px] font-bold text-red-600 mt-1">
                        {item.availableStock === 0
                          ? 'Out of stock'
                          : `Only ${item.availableStock} left`}
                      </div>
                    )}

                    <div className="flex items-center space-x-3 mt-2">
                      <button
                        onClick={() => updateCartQty(item.id, item.quantity - 1)}
                        data-testid="qty-decrease"
                        className="p-0.5 border border-stone-300 rounded hover:bg-stone-50 transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-black text-[#2A2A2A] w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(item.id, item.quantity + 1)}
                        data-testid="qty-increase"
                        className="p-0.5 border border-stone-300 rounded hover:bg-stone-50 transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-[#3A6038] text-sm">₹{item.lineTotal}</span>
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
              {delivery === 0 ? (
                <span className="text-[#3A6038] font-bold">FREE</span>
              ) : (
                <span className="font-bold">₹{delivery}</span>
              )}
            </div>
            {delivery > 0 && (
              <div className="text-[11px] text-[#6b6661] mb-2">
                Add ₹{FREE_DELIVERY_THRESHOLD - subtotal} more for free delivery
              </div>
            )}
            <div className="flex justify-between mb-6 text-lg font-black text-[#2A2A2A]">
              <span>Total:</span>
              <span>₹{subtotal + delivery}</span>
            </div>
            {checkoutEnabled && (
              <button
                onClick={onCheckout}
                data-testid="checkout-now"
                className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl transition"
              >
                Checkout Now
              </button>
            )}

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppOrder}
                className={
                  checkoutEnabled
                    ? 'w-full flex items-center justify-center border-2 border-[#25D366] text-[#1DA851] hover:bg-[#25D366]/5 font-bold py-3 rounded-xl transition mt-2.5'
                    : 'w-full flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-xl transition'
                }
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                {checkoutEnabled ? 'Prefer to order on WhatsApp?' : 'Complete Order on WhatsApp'}
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
