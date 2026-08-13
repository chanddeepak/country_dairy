import { useCallback, useEffect, useState } from 'react';
import { Search, X, Phone, Mail, Wallet, ShoppingBag, Loader2, IndianRupee } from 'lucide-react';
import { adminApi } from '../services/apiClient';
import Pagination from '../components/Pagination';
import { displayName, type AdminCustomer } from '../types';

const money = (value: string | number | undefined) => Number(value ?? 0).toLocaleString('en-IN');

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

interface CustomersProps {
  /** Set when the wallet feature is enabled; hides balance columns otherwise. */
  walletEnabled?: boolean;
}

export default function Customers({ walletEnabled = false }: CustomersProps) {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCust, setSelectedCust] = useState<AdminCustomer | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, pageSize: 50 });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await adminApi.getCustomers(search || undefined, { page });
      setCustomers(result.items);
      setPageInfo({
        total: result.total,
        totalPages: result.totalPages,
        pageSize: result.pageSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customers');
    } finally {
      setIsLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Search runs server-side, debounced.
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const openCustomer = async (customer: AdminCustomer) => {
    setSelectedCust(customer);
    setIsLoadingDetail(true);
    try {
      // The list omits addresses and order history; fetch them on open.
      setSelectedCust(await adminApi.getCustomer(customer.id));
    } catch {
      // Keep the row data already on screen if the detail call fails.
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Customer Profiles Directory</h2>
            <p className="text-xs text-stone-500">
              Search profiles, trace order counts and lifetime spend.
            </p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="w-full bg-stone-50 border border-stone-200 pl-10 pr-4 py-2.5 rounded-lg text-sm text-stone-850 focus:outline-none focus:border-[#064e3b]"
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
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-xs text-stone-500 font-medium">
            {search ? 'No customers match that search.' : 'No customers have signed up yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Contact Phone</th>
                  <th className="p-4">Email Address</th>
                  {walletEnabled && <th className="p-4">Wallet Balance</th>}
                  <th className="p-4 text-center">Orders</th>
                  <th className="p-4 text-right">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openCustomer(c)}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/30 transition-colors text-sm cursor-pointer"
                  >
                    <td className="p-4 font-bold text-stone-800">{displayName(c)}</td>
                    <td className="p-4 text-stone-600 font-medium">{c.phone || '—'}</td>
                    <td className="p-4 text-stone-600">{c.email || '—'}</td>
                    {walletEnabled && (
                      <td className="p-4 font-black text-[#064e3b]">₹{money(c.walletBalance)}</td>
                    )}
                    <td className="p-4 text-center font-bold text-stone-700">{c.totalOrders ?? 0}</td>
                    <td className="p-4 text-right font-black text-stone-900">
                      ₹{money(c.totalSpent)}
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
          noun="customers"
        />
      </div>

      {/* Profile Detail Drawer */}
      {selectedCust && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-stone-200 z-50 flex flex-col animate-slide-in-right">
          <div className="flex justify-between items-center p-6 border-b border-stone-100">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Customer Account Profile</h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">{selectedCust.id}</p>
            </div>
            <button
              onClick={() => setSelectedCust(null)}
              className="text-stone-400 hover:text-stone-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200/55">
              <div className="w-12 h-12 rounded-full bg-[#064e3b] text-white flex items-center justify-center font-black text-lg">
                {displayName(selectedCust).charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">{displayName(selectedCust)}</h4>
                <p className="text-xs text-stone-500">{selectedCust.email || selectedCust.phone}</p>
                {selectedCust.createdAt && (
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Customer since {formatDate(selectedCust.createdAt)}
                  </p>
                )}
              </div>
            </div>

            <div className={`grid gap-2 ${walletEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {walletEnabled && (
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/40 text-center">
                  <Wallet className="h-4 w-4 text-[#064e3b] mx-auto mb-1" />
                  <span className="text-xs text-stone-500 font-bold block">Wallet</span>
                  <span className="text-sm font-black text-[#064e3b]">
                    ₹{money(selectedCust.walletBalance)}
                  </span>
                </div>
              )}
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/40 text-center">
                <ShoppingBag className="h-4 w-4 text-[#064e3b] mx-auto mb-1" />
                <span className="text-xs text-stone-500 font-bold block">Orders</span>
                <span className="text-sm font-black text-stone-900">
                  {selectedCust.totalOrders ?? selectedCust.orders?.length ?? 0}
                </span>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/40 text-center">
                <IndianRupee className="h-4 w-4 text-[#064e3b] mx-auto mb-1" />
                <span className="text-xs text-stone-500 font-bold block">Spend</span>
                <span className="text-sm font-black text-stone-900">
                  ₹{money(selectedCust.totalSpent)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Contact details
              </h4>
              <div className="space-y-2 text-sm text-stone-750">
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-stone-400" /> {selectedCust.phone || 'Not provided'}
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-stone-400" /> {selectedCust.email || 'Not provided'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Saved Addresses
              </h4>
              {isLoadingDetail ? (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : selectedCust.addresses?.length ? (
                selectedCust.addresses.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 font-medium"
                  >
                    📍 {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}
                    {a.isDefault && (
                      <span className="ml-2 text-[10px] font-bold text-emerald-700">DEFAULT</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-stone-400 font-medium">No saved addresses.</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Recent Orders
              </h4>
              {isLoadingDetail ? (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : selectedCust.orders?.length ? (
                <div className="space-y-2">
                  {selectedCust.orders.map((o) => (
                    <div
                      key={o.id}
                      className="flex justify-between items-center p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                    >
                      <div>
                        <div className="font-bold text-stone-800">{o.orderNumber}</div>
                        <div className="text-stone-500">{formatDate(o.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-stone-900">₹{money(o.totalAmount)}</div>
                        <div className="text-stone-500">{o.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 font-medium">No orders yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
