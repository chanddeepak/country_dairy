import { useState } from 'react';
import { X, Printer, Phone, MapPin, Calendar, Clock, ShoppingBag } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

interface Order {
  id: string;
  customer: string;
  items: string;
  total: number;
  deliveryType: string;
  status: string;
  paymentStatus: string;
  date: string;
  waybill: string;
}

interface OrdersProps {
  orders: Order[];
  onUpdateOrders: (newOrders: Order[]) => void;
}

export default function Orders({ orders, onUpdateOrders }: OrdersProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleStatusChange = (orderId: string, newStatus: string) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: newStatus };
      }
      return o;
    });
    onUpdateOrders(updated);
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const triggerInvoicePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${order.id}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1c1917; padding: 40px; margin: 0; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e7e5e4; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #064e3b; }
            .meta { font-size: 13px; text-align: right; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; font-size: 14px; }
            .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #78716c; margin-bottom: 8px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background: #fafaf9; text-align: left; font-size: 12px; text-transform: uppercase; color: #78716c; padding: 10px; border-bottom: 1px solid #e7e5e4; }
            .items-table td { padding: 12px 10px; border-bottom: 1px solid #e7e5e4; font-size: 14px; }
            .totals { display: flex; flex-direction: column; align-items: flex-end; font-size: 14px; gap: 6px; }
            .grand-total { font-size: 18px; font-weight: 900; color: #064e3b; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Country Dairy</div>
              <div style="font-size: 12px; color: #6b6661; margin-top: 4px;">Farm-Fresh & Quality Assured Products</div>
            </div>
            <div class="meta">
              <strong>Invoice #: ${order.id}</strong><br/>
              Date: ${order.date}<br/>
              Status: ${order.status}
            </div>
          </div>

          <div class="details">
            <div>
              <div class="section-title">Delivery To</div>
              <strong>${order.customer}</strong><br/>
              Delhi NCR, India<br/>
              Fulfillment: ${order.deliveryType}
            </div>
            <div>
              <div class="section-title">Billing Status</div>
              Payment Status: <strong>${order.paymentStatus}</strong><br/>
              Gateway: Mock Razorpay / Wallet<br/>
              Currency: INR
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item Summary</th>
                <th>Qty</th>
                <th>Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${order.items}</td>
                <td>1</td>
                <td>₹${order.total}</td>
                <td style="text-align: right; font-weight: bold;">₹${order.total}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div>Subtotal: ₹${order.total}</div>
            <div>Delivery: FREE</div>
            <div class="grand-total">Total Paid: ₹${order.total}</div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Orders Grid/Table */}
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm relative">
        <div className="screen-header mb-6">
          <h2 className="text-lg font-bold text-stone-800">Order Processing Management</h2>
          <p className="text-xs text-stone-500">Track and dispatch customer checkout invoices and delivery route sheets.</p>
        </div>

        <table className="data-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Order Summary</th>
              <th className="p-4">Total</th>
              <th className="p-4">Fulfillment</th>
              <th className="p-4">Status</th>
              <th className="p-4">Payment</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr 
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="border-b border-stone-100 last:border-0 hover:bg-stone-50/30 transition-colors text-sm cursor-pointer"
              >
                <td className="p-4 font-bold text-stone-800">{o.id}</td>
                <td className="p-4 text-stone-700">{o.customer}</td>
                <td className="p-4 text-stone-600 line-clamp-1 max-w-[200px]">{o.items}</td>
                <td className="p-4 font-bold text-stone-850">₹{o.total}</td>
                <td className="p-4">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                    o.deliveryType === 'LOCAL' 
                      ? 'bg-blue-50 text-blue-700 border-blue-100' 
                      : 'bg-purple-50 text-purple-700 border-purple-100'
                  }`}>
                    {o.deliveryType}
                  </span>
                </td>
                <td className="p-4">
                  <StatusBadge status={o.status} />
                </td>
                <td className="p-4">
                  <StatusBadge status={o.paymentStatus} />
                </td>
                <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
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

      {/* Side Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-stone-200 z-50 flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-stone-100">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Order Details</h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">{selectedOrder.id}</p>
            </div>
            <button onClick={() => setSelectedOrder(null)} className="text-stone-400 hover:text-stone-600 transition">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status updates */}
            <div className="bg-[#064e3b]/5 p-4 rounded-xl border border-[#064e3b]/10 space-y-2">
              <label className="text-xs font-bold text-[#064e3b] uppercase">Fulfillment Status</label>
              <select
                value={selectedOrder.status}
                onChange={e => handleStatusChange(selectedOrder.id, e.target.value)}
                className="w-full bg-white border border-stone-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-[#064e3b]"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {/* Customer info */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Customer Profile</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-sm text-stone-800">
                  <Printer className="h-4 w-4 text-stone-400" />
                  <span className="font-bold">{selectedOrder.customer}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-stone-600">
                  <Phone className="h-4 w-4 text-stone-400" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-stone-650">
                  <MapPin className="h-4 w-4 text-stone-400" />
                  <span>Sector 62, Noida, Delhi NCR</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Fulfillment Timeline</h4>
              <div className="space-y-4 relative pl-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                <div className="relative flex gap-3 text-xs">
                  <Calendar className="absolute -left-5 h-4 w-4 text-emerald-600 bg-white" />
                  <div>
                    <p className="font-bold text-stone-800">Order Placed</p>
                    <p className="text-stone-500">{selectedOrder.date}</p>
                  </div>
                </div>
                <div className="relative flex gap-3 text-xs">
                  <Clock className="absolute -left-5 h-4 w-4 text-emerald-600 bg-white" />
                  <div>
                    <p className="font-bold text-stone-800">Payment Status: {selectedOrder.paymentStatus}</p>
                  </div>
                </div>
                <div className="relative flex gap-3 text-xs">
                  <ShoppingBag className="absolute -left-5 h-4 w-4 text-stone-400 bg-white" />
                  <div>
                    <p className="font-bold text-stone-700">Dispatch Status: {selectedOrder.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Cart Invoice Items</h4>
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-stone-800">{selectedOrder.items}</span>
                  <span className="font-black text-stone-900">₹{selectedOrder.total}</span>
                </div>
                <div className="border-t border-stone-200 pt-2 flex justify-between text-xs text-stone-500">
                  <span>Shipping</span>
                  <span className="text-emerald-700 font-bold">FREE</span>
                </div>
                <div className="flex justify-between text-base font-black text-[#064e3b] pt-1">
                  <span>Grand Total</span>
                  <span>₹{selectedOrder.total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-3">
            <button 
              onClick={() => triggerInvoicePrint(selectedOrder)}
              className="flex-1 bg-[#064e3b] hover:bg-[#065f46] text-white font-semibold text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Printer className="h-4 w-4" /> Print Customer Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
