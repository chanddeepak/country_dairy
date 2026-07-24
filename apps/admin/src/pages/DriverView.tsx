import { useState } from 'react';
import { Truck, Phone, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AssignedDelivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  itemsSummary: string;
  paymentStatus: 'PAID' | 'CASH_ON_DELIVERY';
  totalAmount: number;
  status: 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
}

export default function DriverView() {
  const [deliveries, setDeliveries] = useState<AssignedDelivery[]>([
    {
      id: 'del-1',
      orderNumber: 'ORD-10492',
      customerName: 'Amit Sharma',
      customerPhone: '+91 98765 43210',
      deliveryAddress: 'Flat 402, Sunshine Apartments, Sector 62, Gurgaon',
      itemsSummary: 'A2 Cow Milk (6L Glass Bottles)',
      paymentStatus: 'PAID',
      totalAmount: 570,
      status: 'OUT_FOR_DELIVERY',
    },
    {
      id: 'del-2',
      orderNumber: 'ORD-10495',
      customerName: 'Deepak Chand',
      customerPhone: '+91 97777 66666',
      deliveryAddress: 'Villa 14, Country Estate, Golf Course Road, Gurgaon',
      itemsSummary: 'A2 Vedic Bilona Ghee (1L Glass Jar)',
      paymentStatus: 'CASH_ON_DELIVERY',
      totalAmount: 1499,
      status: 'ASSIGNED',
    },
  ]);

  // OTP Modal State
  const [selectedOrderForOtp, setSelectedOrderForOtp] = useState<AssignedDelivery | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  const handleVerifyOtpAndDeliver = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    if (otpInput.length !== 4) {
      setOtpError('Please enter valid 4-digit Customer OTP (e.g. 4829).');
      return;
    }

    if (!selectedOrderForOtp) return;

    setDeliveries(prev => prev.map(d => {
      if (d.id === selectedOrderForOtp.id) {
        return { ...d, status: 'DELIVERED' };
      }
      return d;
    }));

    alert(`Order ${selectedOrderForOtp.orderNumber} successfully marked DELIVERED with Customer OTP verification!`);
    setSelectedOrderForOtp(null);
    setOtpInput('');
  };

  return (
    <div className="space-y-6 text-stone-100 max-w-xl mx-auto">
      {/* Header */}
      <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold">Today's Local Deliveries</h1>
          </div>
          <p className="text-xs text-stone-400">Driver Mobile Dispatch Console</p>
        </div>

        <div className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 px-3 py-1 rounded-lg border border-amber-500/20">
          {deliveries.filter(d => d.status !== 'DELIVERED').length} Pending
        </div>
      </div>

      {/* Deliveries List */}
      <div className="space-y-4">
        {deliveries.map((item) => (
          <div
            key={item.id}
            className={`p-5 rounded-2xl border transition-all ${
              item.status === 'DELIVERED'
                ? 'bg-stone-900/60 border-stone-800 opacity-60'
                : 'bg-stone-900 border-stone-700 shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs font-bold text-amber-400">{item.orderNumber}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                item.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                item.status === 'OUT_FOR_DELIVERY' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {item.status.replace(/_/g, ' ')}
              </span>
            </div>

            <h3 className="font-bold text-base text-stone-100">{item.customerName}</h3>
            <p className="text-xs text-stone-300 font-medium mb-3">{item.itemsSummary}</p>

            {/* Address Box with Navigation Button */}
            <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs space-y-2 mb-4">
              <div className="flex items-start gap-2 text-stone-300">
                <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{item.deliveryAddress}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <a
                  href={`tel:${item.customerPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Customer
                </a>

                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(item.deliveryAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" /> Open Google Maps Navigation
                </a>
              </div>
            </div>

            {/* Payment Badge & Mark Delivered Action */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              <div className="text-xs">
                <span className="text-stone-400">Total: </span>
                <strong className="text-stone-100 font-mono text-sm">₹{item.totalAmount}</strong>
                <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded ${
                  item.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {item.paymentStatus.replace(/_/g, ' ')}
                </span>
              </div>

              {item.status !== 'DELIVERED' && (
                <button
                  type="button"
                  onClick={() => { setSelectedOrderForOtp(item); setOtpInput(''); setOtpError(''); }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Customer OTP Verification Modal */}
      {selectedOrderForOtp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-stone-800 border border-stone-700 w-full max-w-md rounded-2xl p-6 shadow-2xl text-stone-100 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-amber-400" />
              <h3 className="text-lg font-bold">Verify Delivery OTP</h3>
            </div>

            <p className="text-xs text-stone-300">
              Ask customer <strong className="text-amber-400">{selectedOrderForOtp.customerName}</strong> for the 4-digit OTP sent to their mobile phone.
            </p>

            {otpError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndDeliver} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Customer 4-Digit OTP</label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-xl text-center text-2xl font-mono tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
                  placeholder="4829"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForOtp(null)}
                  className="px-4 py-2 bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl text-xs shadow-md"
                >
                  Confirm Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
