import { useCallback, useEffect, useState } from 'react';
import { Star, ShieldAlert, Check, Trash2, Loader2, Search, BadgeCheck } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { adminApi } from '../services/apiClient';
import type { AdminReview, ReviewStatus } from '../types';

const FILTERS: { label: string; value: ReviewStatus | 'ALL' }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: 'ALL' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Reviews() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<ReviewStatus | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminReview | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [list, counts] = await Promise.all([
        adminApi.getReviewsAdmin(filter === 'ALL' ? undefined : filter, search || undefined),
        adminApi.getReviewStats(),
      ]);
      setReviews(list);
      setStats(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [filter, search]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const handleAction = async (review: AdminReview, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(review.id);
    setError('');
    try {
      const updated = await adminApi.moderateReview(review.id, status);
      setReviews((prev) =>
        filter === 'ALL'
          ? prev.map((r) => (r.id === updated.id ? updated : r))
          : prev.filter((r) => r.id !== updated.id),
      );
      setStats(await adminApi.getReviewStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the review');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    setError('');
    try {
      await adminApi.deleteReview(pendingDelete.id);
      setReviews((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      setStats(await adminApi.getReviewStats());
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the review');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="screen-header mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-stone-850">Customer Reviews Moderation Panel</h2>
            <p className="text-xs text-stone-500">
              Approve or reject customer review entries prior to storefront publication.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {stats.pending} pending
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {stats.approved} approved
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  filter === f.value
                    ? 'bg-[#064e3b] text-white border-[#064e3b]'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product or review text…"
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#064e3b]"
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
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center text-xs text-stone-500 font-medium">
            {filter === 'PENDING'
              ? 'Nothing waiting for moderation.'
              : 'No reviews match this filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4">Review Comment</th>
                  <th className="p-4">Post Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/20 transition-colors text-sm"
                  >
                    <td className="p-4 font-bold text-stone-800">{r.product.title}</td>
                    <td className="p-4 text-stone-700 font-medium">
                      <div>{r.user.name || r.user.email || 'Guest'}</div>
                      {r.isVerifiedPurchase && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-0.5">
                          <BadgeCheck className="h-3 w-3" /> Verified purchase
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }, (_, idx) => (
                          <Star
                            key={idx}
                            className={`h-3.5 w-3.5 ${
                              idx < r.rating ? 'fill-[#C59B27] text-[#C59B27]' : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-stone-600 max-w-[240px]">
                      {r.title && <div className="font-bold text-stone-800">{r.title}</div>}
                      <div className="line-clamp-2" title={r.comment ?? ''}>
                        {r.comment}
                      </div>
                    </td>
                    <td className="p-4 text-stone-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="p-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-4 text-right">
                      {busyId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-stone-400 ml-auto" />
                      ) : r.status === 'PENDING' ? (
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleAction(r, 'APPROVED')}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-1.5 rounded transition"
                            title="Approve Review"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(r, 'REJECTED')}
                            className="bg-red-50 hover:bg-red-100 text-red-800 p-1.5 rounded transition"
                            title="Flag / Reject Review"
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDelete(r)}
                          className="bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-red-700 p-1.5 rounded transition ml-auto block"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete this review?"
        message={`This permanently removes the review by ${
          pendingDelete?.user.name || pendingDelete?.user.email || 'this customer'
        } on ${pendingDelete?.product.title}. It cannot be undone.`}
        confirmLabel="Delete review"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
