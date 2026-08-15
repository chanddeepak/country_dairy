'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Clock, ExternalLink, HelpCircle, MessageCircle, RefreshCw } from 'lucide-react';
import { trackingLabelFor, trackingUrlFor } from '@country-dairy/types';
import { whatsAppUrl } from '../../../lib/storeConfig';
import { useStoreConfig } from '../../../context/StoreConfigContext';
import { useApp } from '../../../context/AppContext';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import Badge from '../../../components/ui/Badge';
import AuthModal from '../../../components/modals/AuthModal';

/** Never renders NaN: a missing figure reads as ₹0 rather than as broken output. */
function money(value: unknown): string {
  const n = Number(value);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function OrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.orderId as string;
  const isSuccess = searchParams?.get('status') === 'success';

  const { user, isSessionReady, sessionExpired, authFetch, reorder } = useApp();
  const { whatsapp } = useStoreConfig();
  const router = useRouter();
  const [reordering, setReordering] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [queryOpen, setQueryOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [queryNote, setQueryNote] = useState('');
  const [sendingQuery, setSendingQuery] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // 'missing' covers both "no such order" and "not yours" — the API returns
  // 404 for another customer's order, and so should this page.
  const [status, setStatus] = useState<'loading' | 'found' | 'missing'>('loading');

  useEffect(() => {
    if (!isSessionReady) return;
    if (!user) { setIsAuthOpen(true); return; }
    if (orderId) fetchOrder();
  }, [orderId, isSessionReady, user]);

  const fetchOrder = async () => {
    try {
      // authFetch clears the session on a 401, so a rejected token ends the
      // spinner instead of leaving "Loading order details…" on screen for ever.
      const res = await authFetch(`/orders/${orderId}`);
      if (res?.ok) {
        setOrder(await res.json());
        setStatus('found');
        return;
      }
      setStatus('missing');
    } catch {
      setStatus('missing');
    }
  };

  if (!isSessionReady || (status === 'loading' && user)) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => {}} onAuthOpen={() => setIsAuthOpen(true)} />
        <div className="flex-1 flex items-center justify-center bg-[#FAF8F3]">
          <div className="animate-pulse text-[#6b6661]">Loading order details…</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user || !order) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => {}} onAuthOpen={() => setIsAuthOpen(true)} />
        <div className="flex-1 flex items-center justify-center bg-[#FAF8F3] px-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-md text-center">
            <h1 className="font-serif font-black text-xl text-[#2A2A2A] mb-2">
              {!user
                ? sessionExpired
                  ? 'Your session has ended'
                  : 'Sign in to see this order'
                : 'Order not found'}
            </h1>
            <p className="text-sm text-[#6b6661] leading-relaxed mb-5">
              {!user
                ? 'For your security you have been signed out. Sign in again to track your order.'
                : 'We could not find that order on your account.'}
            </p>
            {!user ? (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-3 bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold rounded-xl transition"
              >
                Sign In
              </button>
            ) : (
              <Link
                href="/account?tab=orders"
                className="inline-block px-6 py-3 bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold rounded-xl transition"
              >
                See my orders
              </Link>
            )}
          </div>
        </div>
        <Footer />
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  const trackingUrl = trackingUrlFor(order.shippingCarrier, order.trackingNumber);

  /**
   * WhatsApp remains for anyone who wants an answer in the next five minutes.
   * The written query beside it goes to the console inbox, where it leaves a
   * record — which is what WhatsApp alone never did.
   */
  const helpUrl = whatsapp?.isEnabled
    ? whatsAppUrl(
        whatsapp,
        `Hello, I need help with my order ${order.orderNumber}.`,
      )
    : null;

  const submitQuery = async () => {
    if (queryText.trim().length < 10) {
      setQueryNote('Tell us a little more so we can help.');
      return;
    }
    setSendingQuery(true);
    setQueryNote('');
    try {
      const res = await authFetch('/support', {
        method: 'POST',
        body: JSON.stringify({
          subject: `Question about order ${order.orderNumber}`,
          body: queryText.trim(),
          orderId: order.id,
        }),
      });

      // authFetch returns null when the session has ended; it has already
      // signed the customer out, so saying "try again" would be a lie.
      if (!res) {
        setQueryNote('Your session ended. Sign in again to send this.');
        return;
      }

      if (!res.ok) {
        const problem = await res.json().catch(() => null);
        setQueryNote(
          Array.isArray(problem?.message) ? problem.message[0] : problem?.message ?? 'Could not send that.',
        );
        return;
      }

      const ticket = await res.json();
      setQueryText('');
      setQueryOpen(false);
      setQueryNote(`Sent. Your reference is ${ticket.ticketRef} — we will reply by email.`);
    } catch {
      setQueryNote('Could not reach the server. Please try again.');
    } finally {
      setSendingQuery(false);
    }
  };

  const handleReorder = async () => {
    setReordering(true);
    setActionNote('');
    try {
      const result = await reorder(order.id);
      if (result?.ok === false) {
        setActionNote(result.error ?? 'Could not add those items to your cart.');
        return;
      }
      router.push('/checkout');
    } catch {
      setActionNote('Could not add those items to your cart.');
    } finally {
      setReordering(false);
    }
  };

  // Each step shows when it happened. These were hardcoded to null, so the
  // two stages a waiting customer actually cares about — has it shipped, has
  // it arrived — were ticked with no date against them.
  const timeline = [
    { label: 'Order placed', date: order.createdAt, done: true },
    {
      label: 'Payment confirmed',
      date: order.confirmedAt ?? order.createdAt,
      done: order.paymentStatus === 'PAID',
    },
    {
      label: 'Shipped / Out for delivery',
      date: order.shippedAt ?? null,
      done: ['SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      label: 'Delivered',
      date: order.deliveredAt ?? null,
      done: order.status === 'DELIVERED',
    },
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
              Order {order.orderNumber}
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
            {/* OrderItem is a snapshot taken at purchase: productTitle,
                variantSizeLabel, unitPrice and lineTotal. Reading item.product.name
                and item.price — neither of which the API sends — is what put
                "Product" and ₹NaN on this page. */}
            {order.orderItems?.length ? (
              order.orderItems.map((item: any) => {
                // Back to exactly what they bought, not just the product: the
                // variant is what carries the size and the price.
                const href = item.product?.slug
                  ? `/products/${item.product.slug}${item.variantId ? `?variant=${item.variantId}` : ''}`
                  : null;

                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-start gap-4 py-3 border-b border-stone-100 last:border-0"
                  >
                    <div className="min-w-0">
                      {href ? (
                        <Link
                          href={href}
                          className="text-base font-bold text-[#2A2A2A] hover:text-[#3A6038] hover:underline transition"
                        >
                          {item.productTitle}
                        </Link>
                      ) : (
                        <span className="text-base font-bold text-[#2A2A2A]">
                          {item.productTitle}
                        </span>
                      )}
                      {item.variantSizeLabel && (
                        <span className="block text-xs text-[#6b6661] mt-0.5">
                          {item.variantSizeLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#6b6661] whitespace-nowrap pt-1">
                      {item.quantity} × {money(item.unitPrice)} ={' '}
                      <span className="text-sm font-bold text-[#2A2A2A]">
                        {money(item.lineTotal)}
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#6b6661]">No item details available.</p>
            )}

            <div className="border-t border-stone-200 mt-4 pt-4 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6b6661]">Subtotal:</span>
                {/* The order carries its own subtotal. Deriving it as
                    total − delivery silently ignored any discount. */}
                <span>{money(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6b6661]">
                    Discount{order.couponCode ? ` (${order.couponCode})` : ''}:
                  </span>
                  <span className="text-[#3A6038]">−{money(order.discountAmount)}</span>
                </div>
              )}
              {Number(order.taxAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6b6661]">GST (included):</span>
                  <span className="text-[#6b6661]">{money(order.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#6b6661]">Delivery:</span>
                <span className="text-[#3A6038] font-bold">
                  {Number(order.deliveryCharges || 0) > 0 ? money(order.deliveryCharges) : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between text-base font-black border-t border-stone-100 pt-2 mt-1">
                <span>Total:</span>
                <span>{money(order.totalAmount)}</span>
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
                  <p>
                    <span className="font-bold text-[#2A2A2A]">Carrier:</span>{' '}
                    {order.shippingCarrier ?? 'Courier'}
                  </p>
                  <p><span className="font-bold text-[#2A2A2A]">AWB:</span> {order.trackingNumber}</p>
                  {trackingUrl ? (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-bold text-[#3A6038] mt-2 hover:underline"
                    >
                      {trackingLabelFor(order.shippingCarrier)}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    // No link rather than a wrong one: sending someone to the
                    // wrong carrier's site makes them think the parcel is lost.
                    <p className="text-xs text-[#6b6661] mt-2">
                      Track this number on {order.shippingCarrier ?? 'the carrier'}&apos;s website.
                    </p>
                  )}
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
          {actionNote && (
            <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {actionNote}
            </p>
          )}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleReorder}
              disabled={reordering}
              className="flex items-center gap-2 bg-[#C59B27] hover:bg-[#b08b22] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${reordering ? 'animate-spin' : ''}`} />
              {reordering ? 'Adding…' : 'Reorder Items'}
            </button>

            {/* Writes to the console inbox, so the question survives past the
                moment it was asked. */}
            <button
              type="button"
              data-testid="ask-a-question"
              onClick={() => setQueryOpen((open) => !open)}
              className="flex items-center gap-2 border border-stone-200 text-[#6b6661] hover:text-[#2A2A2A] font-bold py-2.5 px-6 rounded-lg text-sm transition"
            >
              <HelpCircle className="h-4 w-4" />
              Need Help?
            </button>

            {/* Only rendered when there is somewhere for it to go. A button
                that does nothing is worse than an absent one: it reads as the
                shop ignoring you. */}
            {helpUrl && (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border border-stone-200 text-[#6b6661] hover:text-[#2A2A2A] font-bold py-2.5 px-6 rounded-lg text-sm transition"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </div>

          {queryOpen && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
              <label className="block text-xs font-bold text-[#2A2A2A]">
                What can we help with?
              </label>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={4}
                data-testid="query-body"
                placeholder="Tell us what happened — the more detail, the faster we can sort it."
                className="w-full bg-white border border-stone-200 px-3 py-2.5 rounded-lg text-sm resize-none focus:outline-none focus:border-[#3A6038]"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={submitQuery}
                  disabled={sendingQuery}
                  className="bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-50 transition"
                >
                  {sendingQuery ? 'Sending…' : 'Send question'}
                </button>
                <span className="text-[11px] text-[#6b6661]">
                  Goes straight to the shop with your order number attached.
                </span>
              </div>
            </div>
          )}

          {queryNote && (
            <p className="text-xs font-bold text-[#3A6038] bg-[#3A6038]/5 border border-[#3A6038]/20 rounded-lg p-3">
              {queryNote}
            </p>
          )}
        </div>
      </main>

      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
