import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, AlertTriangle, Eye, MessageCircle, Loader2, PackageSearch } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import ChartView from '../components/ui/ChartView';
import { adminApi } from '../services/apiClient';
import type { DashboardData } from '../types';

const RANGES = [7, 30] as const;

export default function Overview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setData(await adminApi.getDashboard(days));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSendWhatsAppStockAlert = (alert: DashboardData['stockAlerts'][number]) => {
    const text = encodeURIComponent(
      `⚠️ STOCK ALERT: ${alert.productName} (${alert.variantLabel}) is ${
        alert.type === 'OUT_OF_STOCK'
          ? 'OUT OF STOCK (0 units)'
          : `LOW STOCK (${alert.currentStock} units remaining)`
      }. Please restock.`,
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[#6b6661] font-medium">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const outOfStockCount = data.stockAlerts.filter((a) => a.type === 'OUT_OF_STOCK').length;
  const lowStockCount = data.stockAlerts.length - outOfStockCount;
  const revenueInPeriod = data.revenueByDay.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-8 text-[#2A2A2A]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#6b6661] font-medium">
          Showing the last {data.periodDays} days.
        </p>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                days === r
                  ? 'bg-[#064e3b] text-white border-[#064e3b]'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={`Revenue (${data.periodDays}d)`}
          value={`₹${revenueInPeriod.toLocaleString('en-IN')}`}
          subtext={`From ${data.totals.orders} order${data.totals.orders === 1 ? '' : 's'}`}
          icon={<ShoppingCart className="h-5 w-5 text-[#064e3b]" />}
        />
        <StatCard
          title="WhatsApp Order Clicks"
          value={String(data.totals.whatsappClicks)}
          subtext="Storefront pre-filled order clicks"
          icon={<MessageCircle className="h-5 w-5 text-[#25D366]" />}
        />
        <StatCard
          title="Store Visits"
          value={data.totals.pageViews.toLocaleString('en-IN')}
          subtext={`${data.totals.productViews.toLocaleString('en-IN')} product views`}
          icon={<Eye className="h-5 w-5 text-blue-600" />}
        />
        <StatCard
          title="Stock Alerts"
          value={`${data.stockAlerts.length} item${data.stockAlerts.length === 1 ? '' : 's'}`}
          subtext={`${outOfStockCount} out of stock • ${lowStockCount} low stock`}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          trend={data.stockAlerts.length > 0 ? { value: 'Attention', type: 'negative' } : undefined}
        />
      </div>

      {/* Stock Alerts Panel */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-base font-serif font-bold text-[#2A2A2A]">
              Inventory Stock Alerts
            </h2>
          </div>
          {data.stockAlerts.length > 0 && (
            <span className="text-xs font-mono bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-bold">
              {data.stockAlerts.length} action item{data.stockAlerts.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {data.stockAlerts.length === 0 ? (
          <p className="text-xs text-[#6b6661] font-medium py-6 text-center">
            Every live variant is above its restock threshold.
          </p>
        ) : (
          <div className="space-y-3 text-xs">
            {data.stockAlerts.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  item.type === 'OUT_OF_STOCK'
                    ? 'bg-red-50/60 border-red-200 text-red-900'
                    : 'bg-amber-50/60 border-amber-200 text-amber-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-black uppercase ${
                        item.type === 'OUT_OF_STOCK'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#C59B27] text-white'
                      }`}
                    >
                      {item.type.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-[#2A2A2A]">{item.productName}</span>
                    <span className="text-[#6b6661]">({item.variantLabel})</span>
                  </div>
                  <div className="text-[11px] text-[#6b6661] font-mono">
                    SKU: {item.sku} • Stock:{' '}
                    <strong className="text-[#2A2A2A]">{item.currentStock} units</strong> (threshold
                    ≤{item.threshold})
                  </div>
                </div>

                <button
                  onClick={() => handleSendWhatsAppStockAlert(item)}
                  className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Share Alert</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartView type="line" title="Revenue Trend (INR)" data={data.revenueByDay} />
        <ChartView
          type="bar"
          title="Storefront WhatsApp Order Button Clicks"
          data={data.whatsappClicksByDay}
        />
      </div>

      {/* Top products */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-3">
          <PackageSearch className="h-5 w-5 text-[#064e3b]" />
          <h2 className="text-base font-serif font-bold text-[#2A2A2A]">Most Viewed Products</h2>
        </div>

        {data.topProducts.length === 0 ? (
          <p className="text-xs text-[#6b6661] font-medium py-6 text-center">
            No product views recorded yet. Storefront traffic will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {data.topProducts.map((p, idx) => {
              const max = data.topProducts[0].views || 1;
              return (
                <div key={p.productId ?? idx} className="flex items-center gap-3 text-xs">
                  <span className="w-5 font-black text-[#6b6661]">{idx + 1}</span>
                  <span className="flex-1 font-bold text-[#2A2A2A] truncate">{p.title}</span>
                  <div className="w-32 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#064e3b] rounded-full"
                      style={{ width: `${Math.round((p.views / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono font-bold text-[#6b6661]">
                    {p.views}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Device split */}
      {data.deviceSplit.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
          <h2 className="text-base font-serif font-bold text-[#2A2A2A] mb-4 border-b border-stone-100 pb-3">
            Traffic by Device
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            {data.deviceSplit.map((d) => (
              <div key={d.label} className="p-3.5 bg-[#FAF8F3] rounded-xl border border-stone-200/80">
                <div className="text-[#6b6661] font-medium capitalize">{d.label}</div>
                <div className="text-sm font-bold text-[#064e3b] mt-1">
                  {d.value.toLocaleString('en-IN')} events
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
