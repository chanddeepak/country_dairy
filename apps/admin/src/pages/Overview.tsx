import { ShoppingCart, ShieldCheck, AlertTriangle, Eye, MessageCircle } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import ChartView from '../components/ui/ChartView';

export default function Overview() {
  const salesHistory = [
    { label: 'Mon', value: 1200 },
    { label: 'Tue', value: 2400 },
    { label: 'Wed', value: 1800 },
    { label: 'Thu', value: 3100 },
    { label: 'Fri', value: 2900 },
    { label: 'Sat', value: 4300 },
    { label: 'Sun', value: 3300 },
  ];

  const whatsappClicksHistory = [
    { label: 'Mon', value: 28 },
    { label: 'Tue', value: 42 },
    { label: 'Wed', value: 35 },
    { label: 'Thu', value: 58 },
    { label: 'Fri', value: 64 },
    { label: 'Sat', value: 89 },
    { label: 'Sun', value: 72 },
  ];

  // Stock Alerts seed data (low stock <= 10 units, out of stock = 0)
  const stockAlerts = [
    {
      id: 'alt-1',
      productName: 'Country Dairy A2 Vedic Ghee',
      variantLabel: '2.5L Traditional Metal Dolchi',
      sku: 'CD-GHEE-2.5L-DOLCHI',
      currentStock: 0,
      threshold: 5,
      type: 'OUT_OF_STOCK' as const,
      updatedAt: '10 minutes ago',
    },
    {
      id: 'alt-2',
      productName: 'Country Dairy A2 Vedic Ghee',
      variantLabel: '1 Litre Glass Jar',
      sku: 'CD-GHEE-1L',
      currentStock: 6,
      threshold: 10,
      type: 'LOW_STOCK' as const,
      updatedAt: '1 hour ago',
    },
  ];

  const handleSendWhatsAppStockAlert = (alertItem: typeof stockAlerts[0]) => {
    const text = encodeURIComponent(`⚠️ STOCK ALERT: ${alertItem.productName} (${alertItem.variantLabel}) is ${alertItem.type === 'OUT_OF_STOCK' ? 'OUT OF STOCK (0 units)' : `LOW STOCK (${alertItem.currentStock} units remaining)`}. Please restock.`);
    window.open(`https://wa.me/919777766666?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-8 text-[#2A2A2A]">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Gross Sales Today"
          value="₹3,300"
          subtext="From 4 order transactions today"
          icon={<ShoppingCart className="h-5 w-5 text-[#064e3b]" />}
          trend={{ value: '+18.5%', type: 'positive' }}
        />
        <StatCard
          title="WhatsApp Order Clicks"
          value="72"
          subtext="Storefront pre-filled order clicks"
          icon={<MessageCircle className="h-5 w-5 text-[#25D366]" />}
          trend={{ value: '+24.1%', type: 'positive' }}
        />
        <StatCard
          title="Total Store Visits"
          value="1,420"
          subtext="Unique page views today (Vercel)"
          icon={<Eye className="h-5 w-5 text-blue-600" />}
          trend={{ value: '+12.3%', type: 'positive' }}
        />
        <StatCard
          title="Stock Alerts"
          value="2 Items"
          subtext="1 Out of Stock • 1 Low Stock"
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          trend={{ value: 'Attention', type: 'negative' }}
        />
      </div>

      {/* Stock Alerts Panel */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-base font-serif font-bold text-[#2A2A2A]">Inventory Stock Alerts & WhatsApp Notifications</h2>
          </div>
          <span className="text-xs font-mono bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-bold">
            2 Action Items
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {stockAlerts.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                item.type === 'OUT_OF_STOCK'
                  ? 'bg-red-50/60 border-red-200 text-red-900'
                  : 'bg-amber-50/60 border-amber-200 text-amber-900'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-black uppercase ${
                    item.type === 'OUT_OF_STOCK' ? 'bg-red-600 text-white' : 'bg-[#C59B27] text-white'
                  }`}>
                    {item.type.replace('_', ' ')}
                  </span>
                  <span className="font-bold text-[#2A2A2A]">{item.productName}</span>
                  <span className="text-[#6b6661]">({item.variantLabel})</span>
                </div>
                <div className="text-[11px] text-[#6b6661] font-mono">
                  SKU: {item.sku} • Current Stock: <strong className="text-[#2A2A2A]">{item.currentStock} units</strong> (Threshold: ≤{item.threshold}) • {item.updatedAt}
                </div>
              </div>

              <button
                onClick={() => handleSendWhatsAppStockAlert(item)}
                className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Alert Super Admin</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartView
          type="line"
          title="Sales Trend Log (INR)"
          data={salesHistory}
        />
        <ChartView
          type="bar"
          title="Storefront WhatsApp Order Button Clicks"
          data={whatsappClicksHistory}
        />
      </div>

      {/* Platform Telemetry */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm text-[#2A2A2A]">
        <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-3">
          <ShieldCheck className="h-5 w-5 text-[#064e3b]" />
          <h2 className="text-base font-serif font-bold text-[#2A2A2A]">System Telemetry & CDN Edge Health</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#FAF8F3] rounded-xl border border-stone-200/80">
            <div className="text-[#6b6661] font-medium">Supabase DB Pooler</div>
            <div className="text-sm font-bold text-[#064e3b] mt-1">CONNECTED (Supavisor)</div>
          </div>
          <div className="p-3.5 bg-[#FAF8F3] rounded-xl border border-stone-200/80">
            <div className="text-[#6b6661] font-medium">Supabase Storage S3</div>
            <div className="text-sm font-bold text-[#064e3b] mt-1">5MB Limit • WebP Active</div>
          </div>
          <div className="p-3.5 bg-[#FAF8F3] rounded-xl border border-stone-200/80">
            <div className="text-[#6b6661] font-medium">Global Edge CDN</div>
            <div className="text-sm font-bold text-[#064e3b] mt-1">Cloudflare (0ms Cache)</div>
          </div>
          <div className="p-3.5 bg-[#FAF8F3] rounded-xl border border-stone-200/80">
            <div className="text-[#6b6661] font-medium">Vercel Analytics</div>
            <div className="text-sm font-bold text-[#064e3b] mt-1">GDPR Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
