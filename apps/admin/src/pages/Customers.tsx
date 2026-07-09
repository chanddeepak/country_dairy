import { useState } from 'react';
import { Search, X, Phone, Mail, Wallet, ShoppingBag, Calendar } from 'lucide-react';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  walletBalance: number;
  ordersCount: number;
  activeSubscriptions: number;
}

interface CustomersProps {
  customers: Customer[];
}

export default function Customers({ customers }: CustomersProps) {
  const [search, setSearch] = useState('');
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Customer Profiles Directory</h2>
            <p className="text-xs text-stone-500">Search profiles, trace orders count, active subscriptions, and wallet records.</p>
          </div>
          {/* Search bar */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers..." 
              className="w-full bg-stone-50 border border-stone-200 pl-10 pr-4 py-2.5 rounded-lg text-sm text-stone-850 focus:outline-none focus:border-[#064e3b]"
            />
          </div>
        </div>

        <table className="data-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
              <th className="p-4">Customer Name</th>
              <th className="p-4">Contact Phone</th>
              <th className="p-4">Email Address</th>
              <th className="p-4">Wallet Balance</th>
              <th className="p-4 text-center">Orders</th>
              <th className="p-4 text-center">Active Subs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr 
                key={c.id} 
                onClick={() => setSelectedCust(c)}
                className="border-b border-stone-100 last:border-0 hover:bg-stone-50/30 transition-colors text-sm cursor-pointer"
              >
                <td className="p-4 font-bold text-stone-800">{c.name}</td>
                <td className="p-4 text-stone-600 font-medium">{c.phone}</td>
                <td className="p-4 text-stone-600">{c.email}</td>
                <td className="p-4 font-black text-[#064e3b]">₹{c.walletBalance}</td>
                <td className="p-4 text-center font-bold text-stone-700">{c.ordersCount}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    c.activeSubscriptions > 0 
                      ? 'bg-emerald-50 text-emerald-800' 
                      : 'bg-stone-50 text-stone-400'
                  }`}>
                    {c.activeSubscriptions} active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Profile Detail Drawer */}
      {selectedCust && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-stone-200 z-50 flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-stone-100">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Customer Account Profile</h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">{selectedCust.id}</p>
            </div>
            <button onClick={() => setSelectedCust(null)} className="text-stone-400 hover:text-stone-600 transition">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Summary */}
            <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200/55">
              <div className="w-12 h-12 rounded-full bg-[#064e3b] text-white flex items-center justify-center font-black text-lg">
                {selectedCust.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">{selectedCust.name}</h4>
                <p className="text-xs text-stone-500">{selectedCust.email}</p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/40 text-center">
                <Wallet className="h-4 w-4 text-[#064e3b] mx-auto mb-1" />
                <span className="text-xs text-stone-500 font-bold block">Wallet</span>
                <span className="text-sm font-black text-[#064e3b]">₹{selectedCust.walletBalance}</span>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/40 text-center">
                <ShoppingBag className="h-4 w-4 text-[#064e3b] mx-auto mb-1" />
                <span className="text-xs text-stone-500 font-bold block">Orders</span>
                <span className="text-sm font-black text-stone-900">{selectedCust.ordersCount}</span>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/40 text-center">
                <Calendar className="h-4 w-4 text-[#064e3b] mx-auto mb-1" />
                <span className="text-xs text-stone-500 font-bold block">Subs</span>
                <span className="text-sm font-black text-stone-900">{selectedCust.activeSubscriptions}</span>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Contact details</h4>
              <div className="space-y-2 text-sm text-stone-750">
                <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-stone-400" /> {selectedCust.phone}</div>
                <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-stone-400" /> {selectedCust.email}</div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Saved Addresses</h4>
              <div className="p-3 bg-stone-50 border border-stone-150 rounded-lg text-xs text-stone-700 font-medium">
                📍 House 142, Block C, Sector 62, Noida, Uttar Pradesh, 201301
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
