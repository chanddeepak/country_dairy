import { useState } from 'react';
import { Truck, Box, Scale, Ruler, CheckCircle, X, Download } from 'lucide-react';

import type { AdminOrder } from '../types';

interface LogisticsProps {
  orders: AdminOrder[];
  handleDelhiveryBooking: (orderId: string, waybillNum: string) => void;
}

export default function Logistics({ orders, handleDelhiveryBooking }: LogisticsProps) {
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [weight, setWeight] = useState('1.2');
  const [length, setLength] = useState('15');
  const [width, setWidth] = useState('15');
  const [height, setHeight] = useState('20');
  const [booking, setBooking] = useState(false);

  const handleBookShipmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (Number(weight) <= 0) { alert('Weight must be positive'); return; }
    if (Number(length) <= 0 || Number(width) <= 0 || Number(height) <= 0) { alert('Dimensions must be positive'); return; }

    setBooking(true);
    setTimeout(() => {
      const waybillNum = `DELHIVERY-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      handleDelhiveryBooking(selectedOrder.id, waybillNum);
      setBooking(false);
      setSelectedOrder(null);
      alert(`Delhivery API Call Success!\nAWB Assigned: ${waybillNum}`);
    }, 800);
  };

  const handleDownloadLabel = (order: AdminOrder) => {
    const labelWindow = window.open('', '_blank');
    if (!labelWindow) return;

    labelWindow.document.write(`
      <html>
        <head>
          <title>Delhivery Label - ${order.orderNumber}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; }
            .label-border { border: 4px solid #000; padding: 15px; width: 380px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; pb: 10px; margin-bottom: 10px; }
            .logo { font-size: 20px; font-weight: bold; }
            .waybill-section { text-align: center; border-bottom: 2px solid #000; padding: 15px 0; margin-bottom: 10px; }
            .barcode { font-family: 'Libre Barcode 39', monospace; font-size: 40px; margin-bottom: 5px; }
            .awb-text { font-size: 14px; font-weight: bold; }
            .details { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; font-size: 11px; }
            .routing { display: grid; grid-template-columns: 1fr 1fr; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="label-border">
            <div class="header">
              <span class="logo">DELHIVERY</span>
              <span>STANDARD RATE</span>
            </div>
            
            <div class="waybill-section">
              <div class="barcode">||||| | ||||| | ||| ||||</div>
              <div class="awb-text">AWB: ${order.trackingNumber ?? ''}</div>
            </div>

            <div class="details">
              <strong>SHIP TO:</strong><br/>
              ${order.user.name ?? order.user.email ?? 'Customer'}<br/>
              Delhi NCR, India<br/>
              Phone: +91 98765 43210
            </div>

            <div class="details">
              <strong>RETURN ADDRESS:</strong><br/>
              Country Dairy Processing Farm,<br/>
              Gurgaon Highway, Haryana, India
            </div>

            <div class="routing">
              <div>ZONE: North-NCR</div>
              <div style="text-align: right;">WT: 1.2 Kg</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    labelWindow.document.close();
  };

  const courierOrders = orders.filter(o => o.deliveryType === 'COURIER');

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="screen-header mb-6">
          <h2 className="text-lg font-bold text-stone-800">Delhivery Shipping & Booking Console</h2>
          <p className="text-xs text-stone-500">Only orders marked for nationwide delivery (Fulfillment Type: **COURIER**) can be dispatched via Delhivery courier routes.</p>
        </div>

        <table className="data-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
              <th className="p-4">Order ID</th>
              <th className="p-4">Recipient Name</th>
              <th className="p-4">Items Summary</th>
              <th className="p-4">Destination</th>
              <th className="p-4">Delhivery AWB Tracker</th>
              <th className="p-4 text-right">Courier Action</th>
            </tr>
          </thead>
          <tbody>
            {courierOrders.map(o => (
              <tr key={o.orderNumber} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/30 transition-colors text-sm">
                <td className="p-4 font-bold text-stone-800">{o.orderNumber}</td>
                <td className="p-4 text-stone-700">{o.user.name ?? o.user.email ?? 'Customer'}</td>
                <td className="p-4 text-stone-600 line-clamp-1 max-w-[200px]">{o.orderItems.map(i => `${i.productTitle} x ${i.quantity}`).join(', ')}</td>
                <td className="p-4 text-stone-550">Delhi NCR, India</td>
                <td className="p-4 font-mono text-xs">
                  {o.trackingNumber ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1.5 w-fit">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {o.trackingNumber}
                    </span>
                  ) : (
                    <span className="text-stone-400 font-bold bg-stone-50 px-2.5 py-1 rounded-md border border-stone-100 flex items-center gap-1.5 w-fit">
                      Pending Dispatch
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {o.trackingNumber ? (
                    <button 
                      onClick={() => handleDownloadLabel(o)}
                      className="btn-accent bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 ml-auto transition"
                    >
                      <Download className="h-3.5 w-3.5" /> Print Label
                    </button>
                  ) : (
                    <button 
                      onClick={() => setSelectedOrder(o)}
                      className="btn-accent bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 ml-auto transition"
                    >
                      <Truck className="h-3.5 w-3.5" /> Book Shipment
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {courierOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center p-8 text-stone-400 font-bold text-xs uppercase">No courier orders waiting for shipping dispatches</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Booking Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-stone-200 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Book Delhivery Dispatch</h3>
                <p className="text-xs text-stone-500 mt-0.5">{selectedOrder.orderNumber}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-stone-400 hover:text-stone-600 transition"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleBookShipmentSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-600 uppercase flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> Package Weight (Kg):</label>
                <input type="text" value={weight} onChange={e => setWeight(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-600 uppercase flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> Package Dimensions (Cm):</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-450 uppercase font-bold">Length</span>
                    <input type="number" value={length} onChange={e => setLength(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded text-sm text-center" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-450 uppercase font-bold">Width</span>
                    <input type="number" value={width} onChange={e => setWidth(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded text-sm text-center" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-stone-450 uppercase font-bold">Height</span>
                    <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="bg-stone-50 border border-stone-200 px-3 py-2 rounded text-sm text-center" />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={booking}
                className="w-full bg-[#064e3b] text-white font-semibold py-3 rounded-lg text-sm mt-4 hover:bg-[#065f46] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Box className="h-4 w-4" />
                {booking ? 'Requesting Delhivery Waybill AWB...' : 'Confirm Delhivery Shipment Booking'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
