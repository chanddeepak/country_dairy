'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, RefreshCw, HelpCircle, CheckCircle2, Circle, Clock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import Badge from '../../../components/ui/Badge';
import AuthModal from '../../../components/modals/AuthModal';
import { API_URL } from '../../../lib/constants';

export default function OrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.orderId as string;
  const isSuccess = searchParams?.get('status') === 'success';

  const { user, token } = useApp();
  const [order, setOrder] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    if (!user) { setIsAuthOpen(true); return; }
    if (orderId && token) fetchOrder();
  }, [orderId, token, user]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOrder(await res.json());
      }
    } catch { /* noop */ }
  };

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => {}} onAuthOpen={() => setIsAuthOpen(true)} />
        <div className="flex-1 flex items-center justify-center bg-[#FAF8F3]">
          <div className="text-center space-y-4">
            <div className="animate-pulse text-[#6b6661]">Loading order details...</div>
          </div>
        </div>
        <Footer />
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  const timeline = [
    { label: 'Order placed', date: order.createdAt, done: true },
    { label: 'Payment confirmed', date: order.createdAt, done: order.paymentStatus === 'PAID' },
    { label: 'Shipped / Out for delivery', date: null, done: ['SHIPPED', 'DELIVERED'].includes(order.status) },
    { label: 'Delivered', date: null, done: order.status === 'DELIVERED' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onCartOpen={() => {}} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 bg-[#FAF8F3]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Success Banner */}
          {isSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-sm font-bold mb-6 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Order placed successfully! Thank you for your purchase.
            </div>
          )}

          {/* Back Link */}
          <Link href="/account" className="inline-flex items-center text-xs font-bold text-[#3A6038] hover:underline mb-6">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Orders
          </Link>

          {/* Order Header */}
          <div className="mb-8">
            <h1 className="font-serif font-black text-2xl text-[#2A2A2A] mb-2">
              Order #{order.id.slice(0, 12)}…
            </h1>
            <p className="text-xs text-[#6b6661]">Placed: {new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div className="flex gap-3 mt-3">
              <Badge status={order.status} />
              <Badge status={order.paymentStatus} />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">ITEMS</h3>
            {order.orderItems?.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm py-2 border-b border-stone-100 last:border-0">
                <span className="text-[#2A2A2A]">{item.product?.name || 'Product'}</span>
                <span className="text-[#6b6661]">
                  Qty: {item.quantity} • ₹{item.price} × {item.quantity} = <span className="font-bold text-[#2A2A2A]">₹{Number(item.price) * item.quantity}</span>
                </span>
              </div>
            )) || <p className="text-xs text-[#6b6661]">No item details available.</p>}

            <div className="border-t border-stone-200 mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6b6661]">Subtotal:</span>
                <span>₹{Number(order.totalAmount) - Number(order.deliveryCharges || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b6661]">Delivery:</span>
                <span className="text-[#3A6038] font-bold">
                  {Number(order.deliveryCharges || 0) > 0 ? `₹${order.deliveryCharges}` : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between text-lg font-black border-t border-stone-100 pt-2">
                <span>Total:</span>
                <span>₹{order.totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">DELIVERY</h3>
            <div className="text-sm text-[#6b6661] space-y-1">
              <p><span className="font-bold text-[#2A2A2A]">Type:</span> {order.deliveryType || 'LOCAL DELIVERY'}</p>
              {order.address && (
                <p>
                  <span className="font-bold text-[#2A2A2A]">Address:</span> {order.shippingAddress?.line1}, {order.shippingAddress?.city} {order.shippingAddress?.postalCode}
                  {order.address.phone && <span className="block text-xs font-semibold text-[#3A6038] mt-1">📞 Contact: {order.address.phone}</span>}
                </p>
              )}
              {order.trackingNumber && (
                <>
                  <p><span className="font-bold text-[#2A2A2A]">Carrier:</span> DELHIVERY</p>
                  <p><span className="font-bold text-[#2A2A2A]">AWB:</span> {order.trackingNumber}</p>
                  <a href="#" className="inline-flex items-center text-xs font-bold text-[#3A6038] mt-2 hover:underline">
                    Track on Delhivery <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
            <h3 className="font-bold text-sm text-[#2A2A2A] mb-4">TIMELINE</h3>
            <div className="space-y-4">
              {timeline.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-stone-300 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm ${step.done ? 'font-bold text-[#2A2A2A]' : 'text-[#6b6661]'}`}>{step.label}</p>
                    {step.date && <p className="text-[11px] text-[#6b6661]">{new Date(step.date).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button className="flex items-center gap-2 bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition">
              <RefreshCw className="h-4 w-4" />
              Reorder Items
            </button>
            <button className="flex items-center gap-2 border border-stone-200 text-[#6b6661] hover:text-[#2A2A2A] font-bold py-2.5 px-6 rounded-lg text-sm transition">
              <HelpCircle className="h-4 w-4" />
              Need Help?
            </button>
          </div>
        </div>
      </main>

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
