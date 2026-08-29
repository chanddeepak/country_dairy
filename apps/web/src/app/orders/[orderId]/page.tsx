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
  /** A failure in the success colour reads as a success. */
  const [queryFailed, setQueryFailed] = useState(false);
  const [querySentRef, setQuerySentRef] = useState('');
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
        <main className="flex-1 bg-[var(--ivory)]">
          {/* Shaped like the real page so nothing jumps when it arrives. */}
          <div
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse"
            role="status"
            aria-label="Loading order"
          >
            <div className="h-3 w-40 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />

            <div className="bg-white border border-[var(--line)] rounded-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-48 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
                <div className="h-6 w-24 rounded-full bg-[rgb(var(--sand-rgb)/0.8)]" />
              </div>
              <div className="h-3 w-32 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
            </div>

            <div className="bg-white border border-[var(--line)] rounded-sm p-6 space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/5 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
                    <div className="h-3 w-1/4 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
                  </div>
                  <div className="h-4 w-16 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
                </div>
              ))}
            </div>

            <div className="bg-white border border-[var(--line)] rounded-sm p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-[rgb(var(--sand-rgb)/0.8)]" />
                  <div className="h-3 w-44 rounded bg-[rgb(var(--sand-rgb)/0.8)]" />
                </div>
              ))}
            </div>
          </div>

          <span className="sr-only">Loading order details</span>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user || !order) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar onCartOpen={() => {}} onAuthOpen={() => setIsAuthOpen(true)} />
        <div className="flex-1 flex items-center justify-center bg-[var(--ivory)] px-4">
          <div className="bg-white border border-[var(--line)] rounded-sm p-8 max-w-md text-center">
            <h1 className="font-serif font-light text-xl text-[var(--ink)] mb-2">
              {!user
                ? sessionExpired
                  ? 'Your session has ended'
                  : 'Sign in to see this order'
                : 'Order not found'}
            </h1>
            <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-5">
              {!user
                ? 'For your security you have been signed out. Sign in again to track your order.'
                : 'We could not find that order on your account.'}
            </p>
            {!user ? (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-3 bg-[var(--forest)] hover:bg-[var(--pine)] text-white text-xs font-bold rounded-sm transition"
              >
                Sign In
              </button>
            ) : (
              <Link
                href="/account?tab=orders"
                className="inline-block px-6 py-3 bg-[var(--forest)] hover:bg-[var(--pine)] text-white text-xs font-bold rounded-sm transition"
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
    setQueryFailed(false);
    setQuerySentRef('');
    try {
      const res = await authFetch('/support', {
        method: 'POST',
        body: JSON.stringify({
          // Built by us, so it is capped here rather than left to fail
          // validation with a message about a field the customer never saw.
          subject: `Question about order ${order.orderNumber}`.slice(0, 120),
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
        const raw = Array.isArray(problem?.message) ? problem.message[0] : problem?.message;

        // The API validates field by field and names those fields. "subject
        // must be shorter than or equal to 120 characters" is meaningless to
        // someone who only saw one box and never typed a subject, so only
        // messages about what they can actually change are passed through.
        // Humanised for the reader, but the real reason still goes to the
        // console — a friendly message that hides the cause makes the next
        // failure take an hour to find.
        // eslint-disable-next-line no-console
        console.error('[support] query rejected:', problem);

        const aboutTheirText = typeof raw === 'string' && /body|more so we can help/i.test(raw);
        setQueryFailed(true);
        setQueryNote(
          aboutTheirText
            ? 'That message is too long. Could you shorten it a little?'
            : 'Could not send that just now. Please try again, or use WhatsApp.',
        );
        return;
      }

      const ticket = await res.json();
      setQueryText('');
      setQueryOpen(false);
      // Not "we will reply by email" — nothing emails them, and the reply
      // lands in a thread they own. Telling them the wrong place to look is
      // how a question that was answered still feels ignored.
      setQuerySentRef(ticket.ticketRef);
      setQueryNote('');
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

      <main className="flex-1 bg-[var(--ivory)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Success Banner */}
          {isSuccess && (
            <div className="bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok)] p-4 rounded-sm text-sm font-bold mb-6 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Order placed successfully! Thank you for your purchase.
            </div>
          )}

          {/* Back Link */}
          <Link href="/account" className="inline-flex items-center text-xs font-bold text-[var(--forest)] hover:underline mb-6">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Orders
          </Link>

          {/* Order Header */}
          <div className="mb-8">
            <h1 className="font-serif font-light text-2xl text-[var(--ink)] mb-2">
              Order {order.orderNumber}
            </h1>
            <p className="text-xs text-[var(--ink-soft)]">Placed: {new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div className="flex gap-3 mt-3">
              <Badge status={order.status} />
              <Badge status={order.paymentStatus} />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white border border-[var(--line)] rounded-sm p-6 mb-6">
            <h3 className="font-bold text-sm text-[var(--ink)] mb-4">ITEMS</h3>
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
                    className="flex justify-between items-start gap-4 py-3 border-b border-[var(--line)] last:border-0"
                  >
                    <div className="min-w-0">
                      {href ? (
                        <Link
                          href={href}
                          className="text-base font-bold text-[var(--ink)] hover:text-[var(--forest)] hover:underline transition"
                        >
                          {item.productTitle}
                        </Link>
                      ) : (
                        <span className="text-base font-bold text-[var(--ink)]">
                          {item.productTitle}
                        </span>
                      )}
                      {item.variantSizeLabel && (
                        <span className="block text-xs text-[var(--ink-soft)] mt-0.5">
                          {item.variantSizeLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--ink-soft)] whitespace-nowrap pt-1">
                      {item.quantity} × {money(item.unitPrice)} ={' '}
                      <span className="text-sm font-bold text-[var(--ink)]">
                        {money(item.lineTotal)}
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[var(--ink-soft)]">No item details available.</p>
            )}

            <div className="border-t border-[var(--line)] mt-4 pt-4 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Subtotal:</span>
                {/* The order carries its own subtotal. Deriving it as
                    total − delivery silently ignored any discount. */}
                <span>{money(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--ink-soft)]">
                    Discount{order.couponCode ? ` (${order.couponCode})` : ''}:
                  </span>
                  <span className="text-[var(--forest)]">−{money(order.discountAmount)}</span>
                </div>
              )}
              {Number(order.taxAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--ink-soft)]">GST (included):</span>
                  <span className="text-[var(--ink-soft)]">{money(order.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Delivery:</span>
                <span className="text-[var(--forest)] font-bold">
                  {Number(order.deliveryCharges || 0) > 0 ? money(order.deliveryCharges) : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between text-base font-black border-t border-[var(--line)] pt-2 mt-1">
                <span>Total:</span>
                <span>{money(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-white border border-[var(--line)] rounded-sm p-6 mb-6">
            <h3 className="font-bold text-sm text-[var(--ink)] mb-4">DELIVERY</h3>
            <div className="text-sm text-[var(--ink-soft)] space-y-1">
              {/*
                * No "Type: LOCAL". That is our own word for whether a parcel
                * goes on the van or to a courier, the desk decides it after the
                * order is placed, and it means nothing to the person reading
                * this page.
                *
                * The address is read from the snapshot, not from `order.address`.
                * A Cashfree order has no addressId — their checkout collects the
                * address and it is stored on the order — so gating on the
                * relation showed this customer a delivery panel with no
                * delivery address in it.
                */}
              {order.shippingAddress?.line1 && (
                <p>
                  <span className="font-bold text-[var(--ink)]">Address:</span>{' '}
                  {[
                    order.shippingAddress.line1,
                    order.shippingAddress.line2,
                    order.shippingAddress.city,
                    order.shippingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  {(order.shippingAddress.phone || order.address?.phone) && (
                    <span className="block text-xs font-semibold text-[var(--forest)] mt-1">
                      Contact {order.shippingAddress.phone || order.address?.phone}
                    </span>
                  )}
                </p>
              )}
              {order.trackingNumber && (
                <>
                  <p>
                    <span className="font-bold text-[var(--ink)]">Carrier:</span>{' '}
                    {order.shippingCarrier ?? 'Courier'}
                  </p>
                  <p><span className="font-bold text-[var(--ink)]">AWB:</span> {order.trackingNumber}</p>
                  {trackingUrl ? (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-bold text-[var(--forest)] mt-2 hover:underline"
                    >
                      {trackingLabelFor(order.shippingCarrier)}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    // No link rather than a wrong one: sending someone to the
                    // wrong carrier's site makes them think the parcel is lost.
                    <p className="text-xs text-[var(--ink-soft)] mt-2">
                      Track this number on {order.shippingCarrier ?? 'the carrier'}&apos;s website.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-[var(--line)] rounded-sm p-6 mb-6">
            <h3 className="font-bold text-sm text-[var(--ink)] mb-4">TIMELINE</h3>
            <div className="space-y-4">
              {timeline.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--ok)] mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--line)] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm ${step.done ? 'font-bold text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>{step.label}</p>
                    {step.date && <p className="text-[11px] text-[var(--ink-soft)]">{new Date(step.date).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {actionNote && (
            <p className="text-xs font-bold text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-line)] rounded-sm p-3">
              {actionNote}
            </p>
          )}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleReorder}
              disabled={reordering}
              className="flex items-center gap-2 bg-[var(--brass)] hover:bg-[var(--forest)] text-[#1a1405] hover:text-[var(--ivory)] font-bold py-2.5 px-6 rounded-sm text-sm transition disabled:opacity-60"
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
              className="flex items-center gap-2 border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)] font-bold py-2.5 px-6 rounded-sm text-sm transition"
            >
              <HelpCircle className="h-4 w-4" />
              Need Help?
            </button>


          </div>

          {queryOpen && (
            <div className="mt-4 bg-white border border-[var(--line)] rounded-sm p-5 space-y-3">
              <label className="block text-xs font-bold text-[var(--ink)]">
                What can we help with?
              </label>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={4}
                data-testid="query-body"
                placeholder="Tell us what happened — the more detail, the faster we can sort it."
                className="w-full bg-white border border-[var(--line)] px-3 py-2.5 rounded-sm text-sm resize-none focus:outline-none focus:border-[var(--forest)]"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitQuery}
                  disabled={sendingQuery}
                  className="bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold text-xs px-4 py-2.5 rounded-sm disabled:opacity-50 transition"
                >
                  {sendingQuery ? 'Sending…' : 'Send question'}
                </button>

                {/* The two ways of asking sit together, because they are the
                    same decision: write it down, or talk to someone now. */}
                {helpUrl && (
                  <>
                    <span className="text-[11px] text-[var(--ink-soft)]">or</span>
                    <a
                      href={helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-[var(--line)] text-[var(--ink)] font-bold text-xs px-4 py-2.5 rounded-sm hover:border-[var(--forest)] transition"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[var(--forest)]" />
                      Chat on WhatsApp
                    </a>
                  </>
                )}
              </div>


            </div>
          )}

          {querySentRef && (
            <div className="mt-4 text-xs rounded-sm p-3 border text-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.05)] border-[rgb(var(--forest-rgb)/0.2)]">
              <p className="font-bold">
                Sent. Your reference is {querySentRef}.
              </p>
              <p className="mt-1 text-[rgb(var(--forest-rgb)/0.85)]">
                We usually reply within a working day. You will find our answer under{' '}
                <Link href="/account?tab=queries" className="font-bold underline underline-offset-2">
                  My Questions
                </Link>
                .
              </p>
            </div>
          )}

          {queryNote && (
            <p
              className={`mt-4 text-xs font-bold rounded-sm p-3 border ${
                queryFailed
                  ? 'text-[var(--danger)] bg-[var(--danger-bg)] border-[var(--danger-line)]'
                  : 'text-[var(--forest)] bg-[rgb(var(--forest-rgb)/0.05)] border-[rgb(var(--forest-rgb)/0.2)]'
              }`}
            >
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
