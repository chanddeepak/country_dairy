import { useState } from 'react';
import { Wallet, Plus, History, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Local shape while the wallet backend is still to be built. The feature sits
 * behind ENABLE_WALLET, so this page is not reachable in a default install.
 */
interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  walletBalance: number;
  ordersCount: number;
  activeSubscriptions: number;
}

interface WalletLog {
  id: string;
  customer: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  date: string;
}

const INITIAL_LOGS: WalletLog[] = [
  { id: 'TX-40912', customer: 'Amit Sharma', amount: 2000, type: 'CREDIT', description: 'Wallet Recharge online', date: 'July 5, 2026' },
  { id: 'TX-40913', customer: 'Amit Sharma', amount: 190, type: 'DEBIT', description: 'Daily subscription drop: 2x A2 Milk', date: 'July 5, 2026' },
  { id: 'TX-40914', customer: 'Priya Sen', amount: 2400, type: 'CREDIT', description: 'Manual Wallet Credit Adjust (Promo)', date: 'July 5, 2026' },
  { id: 'TX-40915', customer: 'Rohan Malhotra', amount: 1090, type: 'DEBIT', description: 'Checkout order: ORD-10494', date: 'July 5, 2026' },
];

interface WalletsProps {
  customers: Customer[];
  onUpdateCustomers: (newCustomers: Customer[]) => void;
}

export default function Wallets({ customers, onUpdateCustomers }: WalletsProps) {
  const [logs, setLogs] = useState<WalletLog[]>(INITIAL_LOGS);
  const [search, setSearch] = useState('');

  // Form states for manual adjustment
  const [targetCustomerName, setTargetCustomerName] = useState('Amit Sharma');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustReason, setAdjustReason] = useState('Recharge balance adjustment');

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Number(adjustAmount);
    if (amountVal <= 0) { alert('Amount must be positive'); return; }

    // Find the target customer profile
    const targetCust = customers.find(c => c.name === targetCustomerName);
    if (!targetCust) {
      alert('Target customer profile not found.');
      return;
    }

    // Overdraft check for DEBIT adjustments
    if (adjustType === 'DEBIT' && targetCust.walletBalance < amountVal) {
      alert(`CANNOT DEBIT WALLET: Insufficient funds. Amit Sharma currently has a balance of ₹${targetCust.walletBalance}. Overdrafts are blocked.`);
      return;
    }

    // Update customer balance in global state
    const updatedCustomers = customers.map(c => {
      if (c.id === targetCust.id) {
        const nextBalance = adjustType === 'CREDIT' 
          ? c.walletBalance + amountVal 
          : c.walletBalance - amountVal;
        return { ...c, walletBalance: nextBalance };
      }
      return c;
    });

    onUpdateCustomers(updatedCustomers);

    const newLog: WalletLog = {
      id: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
      customer: targetCustomerName,
      amount: amountVal,
      type: adjustType,
      description: adjustReason,
      date: new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }),
    };

    setLogs([newLog, ...logs]);
    setAdjustAmount('');
    alert(`Wallet successfully updated!\n${adjustType === 'CREDIT' ? 'Credited' : 'Debited'} ₹${amountVal} for ${targetCustomerName}`);
  };


  const filtered = logs.filter(l => 
    l.customer.toLowerCase().includes(search.toLowerCase()) ||
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.id.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Top adjustment form panel */}
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-stone-100 pb-4">
          <Wallet className="h-5 w-5 text-[#064e3b]" />
          <h2 className="text-lg font-bold text-stone-805">Adjust Customer Wallet Balance</h2>
        </div>

        <form onSubmit={handleAdjustSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="form-group flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600 uppercase">Customer Profile:</label>
            <select
              value={targetCustomerName}
              onChange={e => setTargetCustomerName(e.target.value)}
              className="bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm text-stone-850 focus:outline-none focus:border-[#064e3b]"
            >
              <option value="Amit Sharma">Amit Sharma</option>
              <option value="Priya Sen">Priya Sen</option>
              <option value="Rohan Malhotra">Rohan Malhotra</option>
              <option value="Deepak Chand">Deepak Chand</option>
            </select>
          </div>

          <div className="form-group flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600 uppercase">Transaction Type:</label>
            <select
              value={adjustType}
              onChange={e => setAdjustType(e.target.value as any)}
              className="bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm text-stone-850 focus:outline-none focus:border-[#064e3b]"
            >
              <option value="CREDIT">CREDIT (+) </option>
              <option value="DEBIT">DEBIT (-) </option>
            </select>
          </div>

          <div className="form-group flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600 uppercase">Amount (INR):</label>
            <input 
              type="number" 
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              placeholder="e.g. 500"
              className="bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#064e3b]"
            />
          </div>

          <div className="form-group flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600 uppercase">Description / Reason:</label>
            <input 
              type="text" 
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#064e3b]"
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary lg:col-span-4 bg-[#064e3b] text-white font-semibold text-xs py-3.5 rounded-lg hover:bg-[#065f46] transition flex items-center justify-center gap-1.5 mt-2"
          >
            <Plus className="h-4 w-4" /> Apply Balance Adjustments
          </button>
        </form>
      </div>

      {/* Global transaction ledger */}
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-stone-400" />
            <h2 className="text-lg font-bold text-stone-800">Global Ledger Logs</h2>
          </div>
          {/* Filter */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ledger..." 
              className="w-full bg-stone-50 border border-stone-200 pl-10 pr-4 py-2 rounded-lg text-xs text-stone-850 focus:outline-none focus:border-[#064e3b]"
            />
          </div>
        </div>

        <table className="data-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
              <th className="p-4">Transaction ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Description</th>
              <th className="p-4">Post Date</th>
              <th className="p-4 text-right">Adjustment Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/20 transition-colors text-sm">
                <td className="p-4 font-mono font-bold text-stone-600 text-xs">{l.id}</td>
                <td className="p-4 font-bold text-stone-800">{l.customer}</td>
                <td className="p-4 text-stone-600 font-medium">{l.description}</td>
                <td className="p-4 text-stone-500">{l.date}</td>
                <td className={`p-4 text-right font-black ${
                  l.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  <span className="inline-flex items-center gap-1">
                    {l.type === 'CREDIT' ? <ArrowUpRight className="h-4.5 w-4.5" /> : <ArrowDownRight className="h-4.5 w-4.5" />}
                    {l.type === 'CREDIT' ? '+' : '-'}₹{l.amount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
