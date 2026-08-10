import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react';
import { adminApi } from '../services/apiClient';
import type { DeliveryStop } from '../types';

function money(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * What a delivery driver sees on their phone.
 *
 * The API takes the driver id from the token rather than the request, so this
 * screen can only ever show and complete the signed-in driver's own round.
 *
 * Was two hardcoded deliveries in useState whose "Mark Delivered" button
 * updated nothing outside this component.
 */
export default function DriverView() {
  const [pending, setPending] = useState<DeliveryStop[]>([]);
  const [completed, setCompleted] = useState<DeliveryStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failing, setFailing] = useState<DeliveryStop | null>(null);
  const [failReason, setFailReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [open, done] = await Promise.all([
        adminApi.getMyDeliveries(),
        adminApi.getMyCompletedDeliveries(),
      ]);
      setPending(open);
      setCompleted(done);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your deliveries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cashToCollect = pending.reduce((sum, s) => sum + s.amountToCollect, 0);

  const deliver = async (stop: DeliveryStop) => {
    setBusyId(stop.orderId);
    setError('');
    try {
      const done = await adminApi.markDelivered(stop.orderId);
      setPending((prev) => prev.filter((s) => s.orderId !== stop.orderId));
      setCompleted((prev) => [done, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark that delivered.');
    } finally {
      setBusyId(null);
    }
  };

  const recordFailure = async () => {
    if (!failing) return;

    if (failReason.trim().length < 3) {
      setError('Say why the delivery could not be completed.');
      return;
    }

    setBusyId(failing.orderId);
    setError('');
    try {
      const updated = await adminApi.markDeliveryFailed(failing.orderId, failReason.trim());
      // The stop stays on the round — a failed attempt is not a completed one.
      setPending((prev) => prev.map((s) => (s.orderId === updated.orderId ? updated : s)));
      setFailing(null);
      setFailReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that attempt.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 text-[#2A2A2A] max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-5 w-5 text-[#064e3b]" />
            <h1 className="text-lg font-serif font-bold">My Deliveries</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            {pending.length} to go
            {cashToCollect > 0 ? ` · ${money(cashToCollect)} to collect` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="p-2.5 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors disabled:opacity-50"
          title="Reload"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-[#6b6661] bg-white rounded-2xl border border-stone-200/80">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your round…
        </div>
      ) : (
        <>
          {pending.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-stone-200/80 shadow-sm text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
              <h2 className="text-sm font-bold mb-1">
                {completed.length > 0 ? 'Round complete' : 'Nothing assigned yet'}
              </h2>
              <p className="text-xs text-[#6b6661]">
                {completed.length > 0
                  ? `You delivered ${completed.length} ${completed.length === 1 ? 'order' : 'orders'} today.`
                  : 'Deliveries appear here once dispatch assigns you a route.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((stop, i) => (
                <div
                  key={stop.orderId}
                  className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-bold text-[#6b6661]">
                          #{i + 1}
                        </span>
                        <span className="font-bold">{stop.customerName}</span>
                      </div>
                      <div className="font-mono text-[11px] text-[#6b6661]">
                        {stop.orderNumber}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {stop.isCashOnDelivery ? (
                        <>
                          <div className="font-mono font-black text-[#064e3b]">
                            {money(stop.amountToCollect)}
                          </div>
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                            <Banknote className="h-3 w-3" /> Collect
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono font-bold text-[#6b6661]">
                            {money(stop.totalAmount)}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                            Already paid
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-[#6b6661] leading-relaxed">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#064e3b]" />
                    <span>
                      {stop.addressLine}
                      {stop.pincode ? `, ${stop.pincode}` : ''}
                    </span>
                  </div>

                  <div className="text-xs bg-[#FAF8F3] border border-stone-200 rounded-xl px-3 py-2">
                    {stop.itemsSummary}
                  </div>

                  {stop.customerNote && (
                    <p className="text-[11px] text-[#6b6661] italic">Note: {stop.customerNote}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {stop.customerPhone && (
                      <a
                        href={`tel:${stop.customerPhone}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-stone-50 text-xs font-bold transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    )}

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${stop.addressLine} ${stop.pincode}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-stone-50 text-xs font-bold transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Navigate
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setFailing(stop);
                        setFailReason('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-[#6b6661] hover:bg-red-50 hover:text-red-700 text-xs font-bold transition-colors"
                    >
                      <X className="h-3.5 w-3.5" /> Could not deliver
                    </button>

                    <button
                      type="button"
                      onClick={() => deliver(stop)}
                      disabled={busyId === stop.orderId}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold transition-colors disabled:opacity-50 ml-auto"
                    >
                      {busyId === stop.orderId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {stop.isCashOnDelivery
                        ? `Delivered · ${money(stop.amountToCollect)} collected`
                        : 'Delivered'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] px-5 py-3 border-b border-stone-100">
                Delivered today ({completed.length})
              </h2>
              <div className="divide-y divide-stone-100">
                {completed.map((stop) => (
                  <div
                    key={stop.orderId}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{stop.customerName}</div>
                      <div className="font-mono text-[10px] text-[#6b6661]">
                        {stop.orderNumber}
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Failed attempt */}
      {failing && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4">
            <div>
              <h3 className="text-base font-serif font-bold mb-1">Could not deliver</h3>
              <p className="text-xs text-[#6b6661]">
                {failing.orderNumber} stays on your round so you can try again. Dispatch sees the
                reason.
              </p>
            </div>

            <textarea
              rows={3}
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Nobody home, gate locked, wrong address…"
              className="w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#064e3b]"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFailing(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={recordFailure}
                disabled={busyId === failing.orderId}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {busyId === failing.orderId && <Loader2 className="h-4 w-4 animate-spin" />}
                Record attempt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
