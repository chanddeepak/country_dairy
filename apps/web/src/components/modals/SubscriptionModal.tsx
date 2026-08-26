'use client';

import React, { useState } from 'react';
import { X, Minus, Plus, Calendar, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null;
}

export default function SubscriptionModal({ isOpen, onClose, product }: SubscriptionModalProps) {
  const { user, createSubscription } = useApp();
  const [qty, setQty] = useState(2);
  const [freq, setFreq] = useState('DAILY');
  const [isSuccess, setIsSuccess] = useState(false);
  const [nextDeliveryDate, setNextDeliveryDate] = useState('');

  if (!isOpen || !product) return null;

  const handleConfirm = async () => {
    if (!user) return;
    const res = await createSubscription({
      productId: product.id,
      quantity: qty,
      frequency: freq,
      daysOfWeek: [],
      startDate: new Date().toISOString(),
    });
    if (res && res.id) {
      setNextDeliveryDate(new Date(res.nextDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
      setIsSuccess(true);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgb(var(--ink-rgb)/0.55)] backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white max-w-md w-full p-8 rounded-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="absolute top-4 right-4 text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-[var(--ok-bg)] text-[var(--ok)] rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="font-serif font-light text-2xl text-[var(--ink)] mb-2">Subscription Confirmed!</h3>
            <p className="text-sm text-[var(--ink-soft)] max-w-sm mx-auto mb-6">
              Your subscription for <strong>{qty}x {product.name}</strong> ({freq}) has been successfully activated.
            </p>
            <div className="bg-[var(--cream)] border border-[var(--line)] p-4 rounded-sm text-xs space-y-1 mb-8">
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">First Delivery:</span>
                <strong className="text-[var(--ink)]">{nextDeliveryDate}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Wallet Debit Per Run:</span>
                <strong className="text-[var(--forest)]">₹{Number(product.price) * qty}</strong>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3.5 rounded-sm transition"
            >
              Back to Store
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-[var(--forest)]" />
              <h3 className="font-serif font-light text-2xl text-[var(--ink)]">Configure Subscription</h3>
            </div>
            <p className="text-xs text-[var(--ink-soft)] mb-6">
              Recurring deliveries of <strong>{product.name}</strong> at ₹{product.price}/L. Deducted from your wallet.
            </p>

            <div className="space-y-6 mb-8">
              <div>
                <span className="text-xs font-bold text-[var(--ink)] block mb-2">Fulfillment Schedule:</span>
                <div className="grid grid-cols-3 gap-2">
                  {['DAILY', 'ALTERNATE'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      className={`py-2 px-3 text-xs font-bold rounded-sm border text-center transition ${
                        freq === f
                          ? 'border-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.05)] text-[var(--forest)]'
                          : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--cream)]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                  <button className="py-2 px-3 text-xs font-bold rounded-sm border text-[var(--line)] border-dashed text-center cursor-not-allowed">
                    CUSTOM
                  </button>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-[var(--ink)] block mb-2">Volume Per Day:</span>
                <div className="flex items-center space-x-4 bg-[var(--ivory)] py-2 px-4 rounded-sm border border-[var(--line)] w-32">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-1 hover:bg-[var(--sand)] rounded">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-extrabold text-[var(--forest)] w-6 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="p-1 hover:bg-[var(--sand)] rounded">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[var(--ivory)] border border-[var(--line)] p-4 rounded-sm mb-6 flex justify-between items-center text-sm">
              <span className="text-[var(--ink-soft)]">Wallet debit per run:</span>
              <span className="font-black text-[var(--forest)] text-lg">₹{Number(product.price) * qty}</span>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3.5 rounded-sm transition"
            >
              Confirm Subscription
            </button>
          </>
        )}
      </div>
    </div>
  );
}
