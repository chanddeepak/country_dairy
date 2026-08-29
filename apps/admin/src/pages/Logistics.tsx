import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Package,
  Printer,
  Truck,
} from 'lucide-react';
import { CARRIERS, trackingUrlFor } from '@country-dairy/types';
import { adminApi } from '../services/apiClient';
import type { AdminOrder } from '../types';

const field =
  'w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm text-[#2A2A2A] focus:outline-none focus:border-[#064e3b] transition-colors';
const label = 'block text-[11px] font-bold text-[#6b6661] uppercase tracking-wider mb-1.5';

function money(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function addressLines(order: AdminOrder): string[] {
  const a = order.shippingAddress;

  return [
    order.user?.name || '',
    a?.line1 || '',
    a?.line2 || '',
    [a?.city, a?.state, a?.postalCode].filter(Boolean).join(' '),
    a?.phone || '',
  ].filter(Boolean);
}

/**
 * The courier consignment desk.
 *
 * This page used to fabricate a waybill — `DELHIVERY-${random}` — alert
 * "Delhivery API Call Success!", and print it onto a shipping label. No such
 * call was made and no carrier would have honoured that number, so a parcel
 * shipped against it was lost the moment it left the door.
 *
 * Booking with Delhivery needs an account and API credentials this store does
 * not have yet, so the desk records the waybill the carrier actually issued.
 * The packing slip prints real order data and no barcode it cannot back up.
 */
export default function Logistics() {
  /**
   * Loads its own orders rather than taking a snapshot from the app shell.
   *
   * The shell fetched once on sign-in and handed the same array down, so this
   * desk showed whatever was true when you logged in — a consignment recorded
   * on the Orders page did not appear here, and switching tabs did not help
   * because nothing refetched. Only a full page reload did, which is not a
   * thing anyone should have to know.
   */
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const page = await adminApi.getOrdersAdmin(undefined, undefined, { pageSize: 200 });
      setOrders(page.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load consignments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [carrier, setCarrier] = useState(CARRIERS[0].name);
  const [awb, setAwb] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // A local milk round is not a courier consignment; only parcels belong here.
  const courierOrders = orders.filter((o) => o.deliveryType !== 'LOCAL');
  /*
   * Only orders that can actually be dispatched.
   *
   * The desk used to list every courier order awaiting a waybill, including
   * ones still PENDING — unpaid. The state machine refused them, so the only
   * result was a confusing error for anyone who tried, and an unpaid order
   * sitting on the dispatch list looking ready to send.
   */
  const awaiting = courierOrders.filter(
    (o) => !o.trackingNumber && (o.status === 'CONFIRMED' || o.status === 'PROCESSING'),
  );
  const dispatched = courierOrders.filter((o) => o.trackingNumber);

  const openOrder = (order: AdminOrder) => {
    setSelected(order);
    setCarrier(order.shippingCarrier || CARRIERS[0].name);
    setAwb(order.trackingNumber || '');
    setError('');
    setSaved(null);
  };

  const save = async () => {
    if (!selected) return;

    if (awb.trim().length < 6) {
      setError('Enter the waybill number the carrier issued.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await adminApi.updateOrderStatusAdmin(selected.id, 'SHIPPED', {
        trackingNumber: awb.trim(),
        shippingCarrier: carrier,
        note: `Handed to ${carrier}, AWB ${awb.trim()}`,
      });
      setSaved(selected.id);
      setSelected(null);
      setAwb('');
      // Re-read rather than patch in place: the order may also have moved on
      // elsewhere, and the desk should show what the server says.
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that consignment.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Closes a consignment off from the desk.
   *
   * A courier order is delivered by the carrier, not by anyone on a round, so
   * there was no way to record the outcome except by finding the order on the
   * fulfilment page. The desk that dispatched it is where the news arrives.
   */
  const markDelivered = async (order: AdminOrder) => {
    setIsSaving(true);
    setError('');
    try {
      await adminApi.updateOrderStatusAdmin(order.id, 'DELIVERED', {
        note: `Delivered by ${order.shippingCarrier ?? 'carrier'}`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark that delivered');
    } finally {
      setIsSaving(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('Could not copy — select the number and copy it manually.');
    }
  };

  const printPackingSlip = (order: AdminOrder) => {
    const win = window.open('', '_blank');
    if (!win) {
      setError('Your browser blocked the print window. Allow pop-ups for this site.');
      return;
    }

    const rows = (order.orderItems ?? [])
      .map(
        (i) =>
          `<tr><td>${i.productTitle}${i.variantSizeLabel ? ` (${i.variantSizeLabel})` : ''}</td>` +
          `<td class="c">${i.quantity}</td><td class="r">${money(Number(i.lineTotal ?? 0))}</td></tr>`,
      )
      .join('');

    win.document.write(`<!doctype html><html><head><title>Packing slip ${order.orderNumber}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #111; }
  .slip { max-width: 480px; margin: 0 auto; border: 2px solid #111; padding: 20px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .muted { color: #555; font-size: 12px; }
  .sec { border-top: 1px solid #ccc; margin-top: 14px; padding-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  td, th { padding: 5px 0; border-bottom: 1px solid #eee; text-align: left; }
  .c { text-align: center; } .r { text-align: right; }
  .total { font-weight: 700; font-size: 14px; }
  .awb { font-family: monospace; font-size: 15px; font-weight: 700; }
</style></head><body>
<div class="slip">
  <h1>Country Dairy</h1>
  <div class="muted">Packing slip · ${order.orderNumber}</div>

  <div class="sec">
    <div class="muted">Deliver to</div>
    ${addressLines(order).map((l) => `<div>${l}</div>`).join('')}
  </div>

  <div class="sec">
    <table>
      <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="r total" style="margin-top:8px">${money(Number(order.totalAmount))}</div>
    <div class="r muted">${order.paymentStatus === 'PAID' ? 'Paid online — collect nothing' : 'Cash on delivery'}</div>
  </div>

  ${
    order.trackingNumber
      ? `<div class="sec"><div class="muted">${order.shippingCarrier ?? 'Carrier'} waybill</div>
         <div class="awb">${order.trackingNumber}</div></div>`
      : ''
  }
</div>
<script>window.print()</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#064e3b]" />
            <h1 className="text-xl font-serif font-bold">Courier Consignments</h1>
          </div>

          <button
            type="button"
            data-testid="refresh-consignments"
            onClick={() => void load()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#064e3b] border border-[#064e3b]/25 rounded-lg hover:bg-[#064e3b] hover:text-white disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isLoading ? 'Loading' : 'Refresh'}
          </button>
        </div>

        {loadError && (
          <p className="mt-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {loadError}
          </p>
        )}
        <p className="text-xs text-[#6b6661]">
          Orders shipped by carrier rather than delivered on a local round. Record the waybill the
          carrier issues and the customer can track it from their order page.
        </p>

        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Automatic booking is not connected. It needs a Delhivery account and API credentials —
            until then, book on the carrier&apos;s own portal and enter the waybill here.
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          <Check className="h-4 w-4 shrink-0" />
          <span>Consignment recorded.</span>
        </div>
      )}

      {courierOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200/80 shadow-sm text-center">
          <Package className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <h2 className="text-sm font-bold mb-1">No courier orders</h2>
          <p className="text-xs text-[#6b6661] max-w-md mx-auto">
            Every current order is a local delivery. Those are planned on the route sheets rather
            than shipped by carrier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Awaiting dispatch */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] px-5 py-3 border-b border-stone-100">
              Awaiting dispatch ({awaiting.length})
            </h2>

            {awaiting.length === 0 ? (
              <p className="px-5 py-8 text-xs text-[#6b6661] text-center">
                Everything is on its way.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {awaiting.map((order) => (
                  <div key={order.id} className="px-5 py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold">{order.orderNumber}</div>
                      <div className="text-xs text-[#6b6661] mt-0.5 truncate">
                        {order.user?.name ?? 'Customer'} · {money(Number(order.totalAmount))}
                      </div>
                      <div className="text-[11px] text-[#6b6661] mt-0.5 truncate">
                        {addressLines(order).slice(-2).join(' · ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => printPackingSlip(order)}
                        className="p-2 text-stone-400 hover:text-[#064e3b] hover:bg-stone-50 rounded-lg transition-colors"
                        title="Print packing slip"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openOrder(order)}
                        className="px-3 py-1.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-[11px] rounded-lg transition-colors whitespace-nowrap"
                      >
                        Add waybill
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dispatched */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] px-5 py-3 border-b border-stone-100">
              Dispatched ({dispatched.length})
            </h2>

            {dispatched.length === 0 ? (
              <p className="px-5 py-8 text-xs text-[#6b6661] text-center">
                Nothing dispatched yet.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {dispatched.map((order) => {
                  const url = trackingUrlFor(order.shippingCarrier, order.trackingNumber!);

                  return (
                    <div key={order.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold">{order.orderNumber}</div>
                          <div className="text-xs text-[#6b6661] mt-0.5 truncate">
                            {order.user?.name ?? 'Customer'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {order.status !== 'DELIVERED' ? (
                            <button
                              type="button"
                              data-testid="mark-delivered"
                              disabled={isSaving}
                              onClick={() => markDelivered(order)}
                              className="px-2.5 py-1.5 text-[11px] font-bold text-[#064e3b] border border-[#064e3b]/30 rounded-lg hover:bg-[#064e3b] hover:text-white disabled:opacity-50 transition-colors"
                              title="Record that the carrier delivered this"
                            >
                              Delivered
                            </button>
                          ) : (
                            <span className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg">
                              Delivered
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => printPackingSlip(order)}
                            className="p-2 text-stone-400 hover:text-[#064e3b] hover:bg-stone-50 rounded-lg transition-colors"
                            title="Print packing slip"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openOrder(order)}
                            className="px-3 py-1.5 rounded-lg border border-stone-200 text-[#6b6661] hover:bg-stone-50 font-bold text-[11px] transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-[#6b6661]">
                          {order.shippingCarrier || 'Carrier'}
                        </span>
                        <code className="font-mono text-[11px] bg-[#FAF8F3] border border-stone-200 rounded px-2 py-1">
                          {order.trackingNumber}
                        </code>
                        <button
                          type="button"
                          onClick={() => copy(order.trackingNumber!)}
                          className="p-1.5 text-stone-400 hover:text-[#064e3b] rounded transition-colors"
                          title="Copy waybill"
                        >
                          {copied === order.trackingNumber ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#064e3b] hover:underline"
                          >
                            Track <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waybill entry */}
      {selected && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4">
            <div>
              <h3 className="text-base font-serif font-bold mb-1">Record consignment</h3>
              <p className="text-xs text-[#6b6661] font-mono">{selected.orderNumber}</p>
            </div>

            <div>
              <label className={label}>Carrier</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={field}>
                {CARRIERS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Waybill / AWB number</label>
              <input
                type="text"
                value={awb}
                onChange={(e) => setAwb(e.target.value.toUpperCase())}
                placeholder="As printed on the carrier's label"
                className={`${field} font-mono`}
              />
              <p className="text-[11px] text-[#6b6661] mt-1.5">
                This is what the customer tracks with, so it must be the number the carrier
                issued.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Mark shipped
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
