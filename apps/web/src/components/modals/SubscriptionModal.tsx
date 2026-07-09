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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700">
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="font-serif font-black text-2xl text-[#2A2A2A] mb-2">Subscription Confirmed!</h3>
            <p className="text-sm text-[#6b6661] max-w-sm mx-auto mb-6">
              Your subscription for <strong>{qty}x {product.name}</strong> ({freq}) has been successfully activated.
            </p>
            <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl text-xs space-y-1 mb-8">
              <div className="flex justify-between">
                <span className="text-[#6b6661]">First Delivery:</span>
                <strong className="text-[#2A2A2A]">{nextDeliveryDate}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b6661]">Wallet Debit Per Run:</span>
                <strong className="text-[#3A6038]">₹{Number(product.price) * qty}</strong>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl transition"
            >
              Back to Store
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-[#3A6038]" />
              <h3 className="font-serif font-black text-2xl text-[#2A2A2A]">Configure Subscription</h3>
            </div>
            <p className="text-xs text-[#6b6661] mb-6">
              Recurring deliveries of <strong>{product.name}</strong> at ₹{product.price}/L. Deducted from your wallet.
            </p>

            <div className="space-y-6 mb-8">
              <div>
                <span className="text-xs font-bold text-[#2A2A2A] block mb-2">Fulfillment Schedule:</span>
                <div className="grid grid-cols-3 gap-2">
                  {['DAILY', 'ALTERNATE'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition ${
                        freq === f
                          ? 'border-[#3A6038] bg-[#3A6038]/5 text-[#3A6038]'
                          : 'border-stone-200 text-[#6b6661] hover:bg-stone-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                  <button className="py-2 px-3 text-xs font-bold rounded-lg border text-stone-300 border-dashed text-center cursor-not-allowed">
                    CUSTOM
                  </button>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-[#2A2A2A] block mb-2">Volume Per Day:</span>
                <div className="flex items-center space-x-4 bg-[#FAF8F3] py-2 px-4 rounded-lg border border-stone-200 w-32">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-1 hover:bg-stone-200 rounded">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-extrabold text-[#3A6038] w-6 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="p-1 hover:bg-stone-200 rounded">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#FAF8F3] border border-stone-200 p-4 rounded-xl mb-6 flex justify-between items-center text-sm">
              <span className="text-[#6b6661]">Wallet debit per run:</span>
              <span className="font-black text-[#3A6038] text-lg">₹{Number(product.price) * qty}</span>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3.5 rounded-xl transition"
            >
              Confirm Subscription
            </button>
          </>
        )}
      </div>
    </div>
  );
}
