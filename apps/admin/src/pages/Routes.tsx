import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCw,
  User,
} from 'lucide-react';
import { adminApi } from '../services/apiClient';
import type { DeliveryStop, RouteSheetResponse } from '../types';

const field =
  'px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm text-[#2A2A2A] focus:outline-none focus:border-[#064e3b] transition-colors';

interface Driver {
  id: string;
  name: string | null;
  phone: string | null;
}

function money(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function todayKey(): string {
  // The API buckets by IST, so the picker must agree or the sheet looks empty
  // after 6:30pm local time in a different zone.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * The dispatch desk: today's local orders grouped into route sheets by
 * pincode, each assignable to a driver.
 *
 * Was three hardcoded manifests for Noida, Delhi and Gurgaon whose delivery
 * ticks were local state — pressing "Delivered" changed nothing anyone else
 * could see.
 */
export default function Routes() {
  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState<RouteSheetResponse | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [activePincode, setActivePincode] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sheets, driverList] = await Promise.all([
        adminApi.getRouteSheets(date),
        adminApi.getDrivers(),
      ]);
      setData(sheets);
      setDrivers(driverList);
      setActivePincode((current) => {
        const keys = sheets.routes.map((r) => r.pincode || 'NO-PINCODE');
        return current && keys.includes(current) ? current : (keys[0] ?? null);
      });
      setSelected(new Set());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load route sheets.');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRoute = useMemo(
    () => data?.routes.find((r) => (r.pincode || 'NO-PINCODE') === activePincode) ?? null,
    [data, activePincode],
  );

  const toggleStop = (orderId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });

  const toggleAll = () => {
    if (!activeRoute) return;
    setSelected((prev) =>
      prev.size === activeRoute.stops.length
        ? new Set()
        : new Set(activeRoute.stops.map((s) => s.orderId)),
    );
  };

  const assign = async (driverId: string | null) => {
    if (selected.size === 0) {
      setError('Select the stops to assign first.');
      return;
    }

    setError('');
    setIsAssigning(true);
    try {
      await adminApi.assignRoute([...selected], driverId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign that route.');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5 text-[#064e3b]" />
            <h1 className="text-xl font-serif font-bold">Delivery Route Sheets</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            Local orders for the day, grouped by pincode. Assign a route to a driver and it
            appears in their app.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors disabled:opacity-50"
            title="Reload"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-stone-50 text-xs font-bold transition-colors"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Day summary */}
      {data && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Stops', value: String(data.totalStops), icon: Package },
            { label: 'Routes', value: String(data.routes.length), icon: MapPin },
            { label: 'Unassigned', value: String(data.unassignedCount), icon: User },
            { label: 'Cash to collect', value: money(data.totalCashToCollect), icon: Banknote },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#6b6661] uppercase tracking-wider mb-1">
                <Icon className="h-3.5 w-3.5" /> {label}
              </div>
              <div className="text-lg font-black font-mono">{value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#6b6661] bg-white rounded-2xl border border-stone-200/80">
          <Loader2 className="h-4 w-4 animate-spin" /> Building route sheets…
        </div>
      ) : !data || data.routes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200/80 shadow-sm text-center">
          <MapPin className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <h2 className="text-sm font-bold mb-1">No local deliveries for this day</h2>
          <p className="text-xs text-[#6b6661] max-w-md mx-auto">
            Route sheets are built from confirmed local orders. Courier consignments are handled
            on the shipping desk instead.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Route list */}
          <div className="lg:col-span-4 space-y-2.5">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] px-1">
              Routes ({data.routes.length})
            </h2>

            {data.routes.map((r) => {
              const key = r.pincode || 'NO-PINCODE';
              const isActive = key === activePincode;
              const assignedCount = r.stops.filter((s) => s.driverId).length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActivePincode(key);
                    setSelected(new Set());
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                    isActive
                      ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-sm'
                      : 'bg-white border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-sm">{r.area}</span>
                    <span
                      className={`font-mono text-[11px] ${isActive ? 'text-white/70' : 'text-[#6b6661]'}`}
                    >
                      {r.pincode || 'no pincode'}
                    </span>
                  </div>
                  <div className={`text-[11px] ${isActive ? 'text-white/70' : 'text-[#6b6661]'}`}>
                    {r.stopCount} {r.stopCount === 1 ? 'stop' : 'stops'} ·{' '}
                    {assignedCount === r.stopCount
                      ? 'fully assigned'
                      : `${r.stopCount - assignedCount} unassigned`}
                    {r.cashToCollect > 0 ? ` · ${money(r.cashToCollect)} to collect` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Manifest */}
          <div className="lg:col-span-8">
            {activeRoute && (
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-stone-100">
                  <div>
                    <h2 className="font-serif font-bold">
                      {activeRoute.area}{' '}
                      <span className="font-mono text-xs text-[#6b6661]">
                        {activeRoute.pincode}
                      </span>
                    </h2>
                    <p className="text-xs text-[#6b6661] mt-0.5">
                      {selected.size > 0
                        ? `${selected.size} selected`
                        : `${activeRoute.stopCount} stops on this sheet`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={assignTo}
                      onChange={(e) => setAssignTo(e.target.value)}
                      className={field}
                    >
                      <option value="">Choose a driver…</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || 'Unnamed driver'}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => assign(assignTo || null)}
                      disabled={isAssigning || selected.size === 0 || !assignTo}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {isAssigning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Assign
                    </button>

                    <button
                      type="button"
                      onClick={() => assign(null)}
                      disabled={isAssigning || selected.size === 0}
                      className="px-3 py-2.5 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-stone-50 text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                      title="Hand these stops back to the pool"
                    >
                      Unassign
                    </button>
                  </div>
                </div>

                <div className="px-5 py-2.5 border-b border-stone-100">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-[#6b6661] uppercase tracking-wider cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.size === activeRoute.stops.length && selected.size > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-[#064e3b]"
                    />
                    Select all
                  </label>
                </div>

                <div className="divide-y divide-stone-100">
                  {activeRoute.stops.map((stop, i) => (
                    <StopRow
                      key={stop.orderId}
                      stop={stop}
                      index={i + 1}
                      isSelected={selected.has(stop.orderId)}
                      onToggle={() => toggleStop(stop.orderId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StopRow({
  stop,
  index,
  isSelected,
  onToggle,
}: {
  stop: DeliveryStop;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-start gap-3 p-5 ${isSelected ? 'bg-[#FAF8F3]' : ''}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-4 w-4 mt-1 accent-[#064e3b] shrink-0"
      />

      <span className="text-[11px] font-mono font-bold text-[#6b6661] mt-0.5 w-5 shrink-0">
        {index}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-bold text-sm">{stop.customerName}</span>
          <span className="font-mono text-[11px] text-[#6b6661]">{stop.orderNumber}</span>
          {stop.driverName ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {stop.driverName}
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Unassigned
            </span>
          )}
        </div>

        <p className="text-xs text-[#6b6661] leading-relaxed">{stop.addressLine}</p>
        <p className="text-xs text-[#2A2A2A] mt-1">{stop.itemsSummary}</p>

        {stop.customerNote && (
          <p className="text-[11px] text-[#6b6661] mt-1 italic">Note: {stop.customerNote}</p>
        )}

        {stop.customerPhone && (
          <a
            href={`tel:${stop.customerPhone}`}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#064e3b] mt-1.5 hover:underline"
          >
            <Phone className="h-3 w-3" /> {stop.customerPhone}
          </a>
        )}
      </div>

      <div className="text-right shrink-0">
        {stop.isCashOnDelivery ? (
          <>
            <div className="font-mono font-black text-sm text-[#064e3b]">
              {money(stop.amountToCollect)}
            </div>
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Collect cash
            </div>
          </>
        ) : (
          <>
            <div className="font-mono font-bold text-sm text-[#6b6661]">
              {money(stop.totalAmount)}
            </div>
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Paid online
            </div>
          </>
        )}
      </div>
    </div>
  );
}
