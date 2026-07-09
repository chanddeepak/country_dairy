import { ShoppingCart, TrendingUp, ShieldCheck, Truck, Server, Activity, Database, Cpu } from 'lucide-react';
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

  const subscriptionHistory = [
    { label: 'Mon', value: 42 },
    { label: 'Tue', value: 44 },
    { label: 'Wed', value: 45 },
    { label: 'Thu', value: 45 },
    { label: 'Fri', value: 46 },
    { label: 'Sat', value: 47 },
    { label: 'Sun', value: 48 },
  ];

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Gross Sales Today"
          value="₹3,300"
          subtext="From 4 order transactions today"
          icon={<ShoppingCart className="h-5 w-5" />}
          trend={{ value: '+18.5%', type: 'positive' }}
        />
        <StatCard
          title="Active Subscriptions"
          value="48"
          subtext="Recurring morning deliveries active"
          icon={<TrendingUp className="h-5 w-5" />}
          trend={{ value: '+4.2%', type: 'positive' }}
        />
        <StatCard
          title="Batch Certifications"
          value="12 / 14"
          subtext="2 manufactured batches pending QA"
          icon={<ShieldCheck className="h-5 w-5" />}
          trend={{ value: 'Attention', type: 'negative' }}
        />
        <StatCard
          title="Delhivery Dispatches"
          value="3"
          subtext="Booked Courier dispatches active"
          icon={<Truck className="h-5 w-5" />}
          trend={{ value: 'Stable', type: 'neutral' }}
        />
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
          title="Active Subscription Sign-Ups"
          data={subscriptionHistory}
        />
      </div>

      {/* Platform Logs / Telemetry */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-stone-100 pb-4">
          <Activity className="h-5 w-5 text-[#064e3b]" />
          <h2 className="text-base font-bold text-stone-800">Operational Infrastructure Monitor</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <Server className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase">API Microservice</p>
              <p className="text-sm font-black text-emerald-800">ONLINE (40ms)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <Database className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase">Prisma Database</p>
              <p className="text-sm font-black text-emerald-800">CONNECTED</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <Cpu className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase">Payment Webhook</p>
              <p className="text-sm font-black text-emerald-800">ACTIVE</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <Truck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase">Delhivery Courier API</p>
              <p className="text-sm font-black text-emerald-800">SYNCED (200 OK)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
