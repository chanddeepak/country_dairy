import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Calendar, Loader2, Mail, MapPin, Phone, Printer, Search, Truck, X } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { adminApi } from '../services/apiClient';
import Pagination from '../components/Pagination';
import type { AdminOrder, OrderStats, OrderStatus } from '../types';

/**
 * Mirrors the API's order state machine. Offering a transition the server will
 * reject only produces a confusing error, so the dropdown shows what is
 * actually possible from the current status.
 */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

const money = (value: string | number) => Number(value).toFixed(2);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export default function Orders({
  onOpenConsignments,
}: {
  /** Jumps to the consignment desk. Courier orders are finished there. */
  onOpenConsignments?: () => void;
} = {}) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; name: string | null }[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, pageSize: 50 });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [list, orderStats] = await Promise.all([
        adminApi.getOrdersAdmin(
          statusFilter === 'ALL' ? undefined : statusFilter,
          search || undefined,
          { page },
        ),
        adminApi.getOrderStatsAdmin(),
      ]);
      setOrders(list.items);
      setPageInfo({
        total: list.total,
        totalPages: list.totalPages,
        pageSize: list.pageSize,
      });
      setStats(orderStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, page]);

  // Filtering while on page 4 would otherwise ask for page 4 of a result set
  // that may only have one page, and show an empty list.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    adminApi
      .getDrivers()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, []);

  const changeFulfilment = async (orderId: string, deliveryType: 'LOCAL' | 'COURIER') => {
    setIsUpdating(true);
    setError('');
    try {
      const updated = await adminApi.setOrderDeliveryType(orderId, deliveryType);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, ...updated } : prev));
    } catch (err) {
      // The API refuses some moves — a parcel already on a waybill, an order
      // already delivered — and the reason is worth showing rather than
      // swallowing into a generic failure.
      setError(err instanceof Error ? err.message : 'Could not change how this order ships');
    } finally {
      setIsUpdating(false);
    }
  };

  const applyUpdate = async (
    orderId: string,
    status: OrderStatus,
    options: { driverId?: string; trackingNumber?: string } = {},
  ) => {
    setIsUpdating(true);
    setError('');
    try {
      const updated = await adminApi.updateOrderStatusAdmin(orderId, status, options);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, ...updated } : prev));
      setStats(await adminApi.getOrderStatsAdmin());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order');
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Tax invoice built from the order's own snapshot rows, including the GST
   * breakdown Indian invoices require. Nothing here is inferred or defaulted.
   */
  const triggerInvoicePrint = (order: AdminOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const addr = order.shippingAddress;
    const itemRows = order.orderItems
      .map(
        (item) => `
          <tr>
            <td>
              <strong>${escapeHtml(item.productTitle)}</strong><br/>
              <span style="font-size:12px;color:#78716c;">
                ${escapeHtml(item.variantSizeLabel)} · SKU ${escapeHtml(item.sku)}
                ${item.hsnCode ? ` · HSN ${escapeHtml(item.hsnCode)}` : ''}
              </span>
            </td>
            <td>${item.quantity}</td>
            <td>₹${money(item.unitPrice)}</td>
            <td>${Number(item.gstRate)}%</td>
            <td style="text-align:right;font-weight:bold;">₹${money(item.lineTotal)}</td>
          </tr>`,
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${escapeHtml(order.orderNumber)}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1c1917; padding: 40px; margin: 0; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e7e5e4; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #064e3b; }
            .meta { font-size: 13px; text-align: right; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; font-size: 14px; }
            .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #78716c; margin-bottom: 8px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            .items-table th { background: #fafaf9; text-align: left; font-size: 12px; text-transform: uppercase; color: #78716c; padding: 10px; border-bottom: 1px solid #e7e5e4; }
            .items-table td { padding: 12px 10px; border-bottom: 1px solid #e7e5e4; font-size: 14px; vertical-align: top; }
            .totals { display: flex; flex-direction: column; align-items: flex-end; font-size: 14px; gap: 6px; }
            .grand-total { font-size: 18px; font-weight: 900; color: #064e3b; margin-top: 10px; }
            .note { margin-top: 40px; font-size: 11px; color: #a8a29e; border-top: 1px solid #e7e5e4; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Country Dairy</div>
              <div style="font-size:12px;color:#6b6661;margin-top:4px;">Farm-Fresh &amp; Quality Assured Products</div>
            </div>
            <div class="meta">
              <strong>Invoice #: ${escapeHtml(order.orderNumber)}</strong><br/>
              Date: ${formatDate(order.createdAt)}<br/>
              Status: ${escapeHtml(order.status)}
            </div>
          </div>

          <div class="details">
            <div>
              <div class="section-title">Delivery To</div>
              <strong>${escapeHtml(order.user.name || order.user.email || 'Customer')}</strong><br/>
              ${escapeHtml(addr.line1)}${addr.line2 ? `, ${escapeHtml(addr.line2)}` : ''}<br/>
              ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} ${escapeHtml(addr.postalCode)}<br/>
              ${addr.phone ? escapeHtml(addr.phone) : ''}<br/>
              Fulfilment: ${escapeHtml(order.deliveryType)}
            </div>
            <div>
              <div class="section-title">Billing</div>
              Payment Status: <strong>${escapeHtml(order.paymentStatus)}</strong><br/>
              Currency: INR<br/>
              ${order.couponCode ? `Coupon: ${escapeHtml(order.couponCode)}<br/>` : ''}
              ${order.trackingNumber ? `Tracking: ${escapeHtml(order.trackingNumber)}` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>GST</th>
                <th style="text-align:right;">Line Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div class="totals">
            <div>Subtotal: ₹${money(order.subtotal)}</div>
            ${Number(order.discountAmount) > 0 ? `<div>Discount: −₹${money(order.discountAmount)}</div>` : ''}
            <div>Delivery: ${Number(order.deliveryCharges) === 0 ? 'FREE' : `₹${money(order.deliveryCharges)}`}</div>
            <div style="color:#78716c;">Includes GST: ₹${money(order.taxAmount)}</div>
            <div class="grand-total">Total: ₹${money(order.totalAmount)}</div>
          </div>

          <div class="note">
            GST is included in the listed prices. This is a computer-generated invoice.
          </div>

          <script>window.onload = function () { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm relative">
        <div className="screen-header mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Order Processing Management</h2>
            <p className="text-xs text-stone-500">
              Track and dispatch customer checkout invoices and delivery route sheets.
            </p>
          </div>

          {stats && (
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                {stats.ordersToday} today
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ₹{stats.totalRevenue.toLocaleString('en-IN')} revenue
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors ${
                  statusFilter === s
                    ? 'bg-[#064e3b] text-white border-[#064e3b]'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                {stats && s !== 'ALL' && stats.byStatus[s] ? ` (${stats.byStatus[s]})` : ''}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order number, customer name, phone or email…"
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#064e3b]"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-stone-500 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-xs text-stone-500 font-medium">
            No orders yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
                  <th className="p-4">Order</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Fulfilment</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/30 transition-colors text-sm cursor-pointer"
                  >
                    <td className="p-4 font-bold text-stone-800 whitespace-nowrap">
                      {o.orderNumber}
                      <div className="text-[10px] font-medium text-stone-400">
                        {formatDate(o.createdAt)}
                      </div>
                    </td>
                    <td className="p-4 text-stone-700">{o.user.name || o.user.email || '—'}</td>
                    <td className="p-4 text-stone-600 max-w-[220px]">
                      <div className="line-clamp-2">
                        {o.orderItems
                          .map((i) => `${i.productTitle} (${i.variantSizeLabel}) × ${i.quantity}`)
                          .join(', ')}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-stone-850 whitespace-nowrap">
                      ₹{money(o.totalAmount)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                          o.deliveryType === 'LOCAL'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-purple-50 text-purple-700 border-purple-100'
                        }`}
                      >
                        {o.deliveryType}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="p-4">
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => triggerInvoicePrint(o)}
                        className="p-1.5 hover:bg-stone-100 rounded text-stone-500 hover:text-stone-800 transition"
                        title="Print Invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageInfo.pageSize}
          total={pageInfo.total}
          totalPages={pageInfo.totalPages}
          onPageChange={setPage}
          noun="orders"
        />
      </div>

      {/* Side Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-stone-200 z-50 flex flex-col animate-slide-in-right">
          <div className="flex justify-between items-center p-6 border-b border-stone-100">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Order Details</h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">{selectedOrder.orderNumber}</p>
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="text-stone-400 hover:text-stone-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4 bg-[#064e3b]/5 p-4 rounded-xl border border-[#064e3b]/10">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#064e3b] uppercase">
                  Advance Fulfilment Status
                </label>
                {NEXT_STATUSES[selectedOrder.status].length === 0 ? (
                  <p className="text-xs text-stone-500 font-medium py-2">
                    This order is {selectedOrder.status.toLowerCase()} and cannot move further.
                  </p>
                ) : (
                  <select
                    value=""
                    disabled={isUpdating}
                    onChange={(e) =>
                      e.target.value &&
                      applyUpdate(selectedOrder.id, e.target.value as OrderStatus)
                    }
                    className="w-full bg-white border border-stone-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-[#064e3b] disabled:opacity-50"
                  >
                    <option value="">Move to…</option>
                    {NEXT_STATUSES[selectedOrder.status].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#064e3b] uppercase">Ships By</label>
                <div className="flex gap-2">
                  {(['LOCAL', 'COURIER'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      data-testid={`ships-by-${type.toLowerCase()}`}
                      disabled={isUpdating || selectedOrder.deliveryType === type}
                      onClick={() => changeFulfilment(selectedOrder.id, type)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition border ${
                        selectedOrder.deliveryType === type
                          ? 'bg-[#064e3b] text-white border-[#064e3b]'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-[#064e3b] disabled:opacity-50'
                      }`}
                    >
                      {type === 'LOCAL' ? 'Local round' : 'Courier'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-stone-500">
                  Local orders appear on the driver route sheets; courier orders appear on the
                  consignment desk.
                </p>

                {selectedOrder.deliveryType === 'COURIER' && onOpenConsignments && (
                  <button
                    type="button"
                    data-testid="open-consignments"
                    onClick={onOpenConsignments}
                    className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[#064e3b] hover:underline"
                  >
                    Open the consignment desk
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {selectedOrder.deliveryType === 'LOCAL' && drivers.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#064e3b] uppercase">Assign Driver</label>
                  <select
                    value={selectedOrder.driver?.id ?? ''}
                    disabled={isUpdating}
                    onChange={(e) =>
                      applyUpdate(selectedOrder.id, selectedOrder.status, {
                        driverId: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-stone-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-[#064e3b] disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || 'Driver'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedOrder.deliveryType === 'COURIER' && (
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <Truck className="h-4 w-4 text-stone-400" />
                  <span>
                    {selectedOrder.trackingNumber
                      ? `Tracking: ${selectedOrder.trackingNumber}`
                      : 'No tracking number yet'}
                  </span>
                </div>
              )}

              {isUpdating && (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Customer Profile
              </h4>
              <div className="space-y-2">
                <div className="text-sm font-bold text-stone-800">
                  {selectedOrder.user.name || 'Customer'}
                </div>
                {selectedOrder.user.email && (
                  <div className="flex items-center gap-2.5 text-sm text-stone-600">
                    <Mail className="h-4 w-4 text-stone-400" />
                    <span>{selectedOrder.user.email}</span>
                  </div>
                )}
                {(selectedOrder.shippingAddress.phone || selectedOrder.user.phone) && (
                  <div className="flex items-center gap-2.5 text-sm text-stone-600">
                    <Phone className="h-4 w-4 text-stone-400" />
                    <span>{selectedOrder.shippingAddress.phone || selectedOrder.user.phone}</span>
                  </div>
                )}
                <div className="flex items-start gap-2.5 text-sm text-stone-600">
                  <MapPin className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
                  <span>
                    {selectedOrder.shippingAddress.line1}
                    {selectedOrder.shippingAddress.line2
                      ? `, ${selectedOrder.shippingAddress.line2}`
                      : ''}
                    , {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}{' '}
                    {selectedOrder.shippingAddress.postalCode}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Fulfilment Timeline
              </h4>
              <div className="space-y-4 relative pl-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                {(
                  [
                    ['Order placed', selectedOrder.createdAt],
                    ['Payment confirmed', selectedOrder.confirmedAt],
                    ['Shipped', selectedOrder.shippedAt],
                    ['Delivered', selectedOrder.deliveredAt],
                  ] as const
                )
                  .filter(([, at]) => !!at)
                  .map(([label, at]) => (
                    <div key={label} className="relative flex gap-3 text-xs">
                      <Calendar className="absolute -left-5 h-4 w-4 text-emerald-600 bg-white" />
                      <div>
                        <p className="font-bold text-stone-800">{label}</p>
                        <p className="text-stone-500">{formatDate(at as string)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Invoice Items
              </h4>
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                {selectedOrder.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm gap-3">
                    <div>
                      <span className="font-bold text-stone-800">{item.productTitle}</span>
                      <div className="text-[11px] text-stone-500">
                        {item.variantSizeLabel} · {item.quantity} × ₹{money(item.unitPrice)}
                        {Number(item.gstRate) > 0 ? ` · GST ${Number(item.gstRate)}%` : ''}
                      </div>
                    </div>
                    <span className="font-black text-stone-900 whitespace-nowrap">
                      ₹{money(item.lineTotal)}
                    </span>
                  </div>
                ))}

                <div className="border-t border-stone-200 pt-2 space-y-1 text-xs text-stone-500">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{money(selectedOrder.subtotal)}</span>
                  </div>
                  {Number(selectedOrder.discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount {selectedOrder.couponCode && `(${selectedOrder.couponCode})`}</span>
                      <span>−₹{money(selectedOrder.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span
                      className={Number(selectedOrder.deliveryCharges) === 0 ? 'text-emerald-700 font-bold' : ''}
                    >
                      {Number(selectedOrder.deliveryCharges) === 0
                        ? 'FREE'
                        : `₹${money(selectedOrder.deliveryCharges)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Includes GST</span>
                    <span>₹{money(selectedOrder.taxAmount)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-base font-black text-[#064e3b] pt-1 border-t border-stone-200">
                  <span>Grand Total</span>
                  <span>₹{money(selectedOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-3">
            <button
              onClick={() => triggerInvoicePrint(selectedOrder)}
              className="flex-1 bg-[#064e3b] hover:bg-[#065f46] text-white font-semibold text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Printer className="h-4 w-4" /> Print Tax Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
