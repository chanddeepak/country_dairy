import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { SupportTicket } from '../../types';

/**
 * Deliberately no fallback to the live site. A hardcoded production URL is
 * how the dev console ended up writing uploads into the production bucket:
 * unset means no link, which is obvious, rather than a link that quietly
 * leaves the environment you are working in.
 */
const STOREFRONT = (import.meta.env.VITE_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/**
 * What was in the box, without leaving the thread.
 *
 * Answering "the seal was broken" means knowing which jar, in which size, at
 * which price. Sending staff to the Orders page to find that loses the reply
 * they were halfway through writing, so this sits on top of the conversation
 * and closes again.
 *
 * Everything shown is the checkout snapshot held on the order line, not the
 * catalogue as it reads today. If the product was renamed or repriced since,
 * the customer is still asking about what they actually received.
 */
export default function OrderPeekModal({
  order,
  onClose,
}: {
  order: NonNullable<SupportTicket['order']>;
  onClose: () => void;
}) {
  // Escape closes it. A modal that can only be dismissed by finding the small
  // cross is a modal people avoid opening.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = order.orderItems ?? [];
  const money = (v: unknown) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.orderNumber}`}
        // Without this a click inside the panel reaches the backdrop and
        // closes the thing the user is reading.
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-stone-100">
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#064e3b]">{order.orderNumber}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {order.status}
              {order.createdAt
                ? ` · placed ${new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1 rounded hover:bg-stone-100 text-stone-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-stone-500">
              No line items came back for this order.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded object-cover border border-stone-200 shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-stone-100 border border-stone-200 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#2A2A2A] truncate">{item.productTitle}</p>
                  <p className="text-[11px] text-stone-500">
                    {item.variantSizeLabel} · {item.sku} · ×{item.quantity}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#2A2A2A] tabular-nums">
                    {money(Number(item.unitPrice) * item.quantity)}
                  </p>
                  {/* Only where the product still exists — a line whose
                      product was deleted keeps its snapshot but has nothing
                      to link to. */}
                  {item.product?.slug && STOREFRONT && (
                    <a
                      href={`${STOREFRONT}/products/${item.product.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#064e3b] hover:underline mt-0.5"
                    >
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">Order total</span>
          <span className="text-sm font-bold text-[#2A2A2A] tabular-nums">
            {money(order.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
