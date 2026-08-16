import { useCallback, useEffect, useState } from 'react';
import { Star, ShieldAlert, Trash2, Loader2, Search, BadgeCheck, Play, X, Undo2 } from 'lucide-react';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { adminApi } from '../services/apiClient';
import { useConfirm } from '../hooks/useConfirm';
import { resolveImageUrl } from '../components/common/ImageUploader';
import type { AdminReview } from '../types';

/**
 * Two lists, not three states.
 *
 * Reviews publish the moment they are written, so approving one was always a
 * no-op and "pending" never meant anything — the only decision anyone actually
 * makes is whether something should come down.
 */
const TABS: { label: string; deleted: boolean }[] = [
  { label: 'Published', deleted: false },
  { label: 'Deleted', deleted: true },
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ live: 0, deleted: 0 });
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const confirm = useConfirm(setError);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; isVideo: boolean } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [list, counts] = await Promise.all([
        adminApi.getReviewsAdmin(showDeleted, search || undefined, page),
        adminApi.getReviewStats(),
      ]);
      setReviews(list.items);
      setTotalPages(list.totalPages);
      setStats(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [showDeleted, search, page]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Filter or search changes reset to the first page, otherwise the reader
  // can land on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [showDeleted, search]);

  /** Shared by every row action: run it, then bring the list back in step. */
  const afterChange = async () => {
    await load();
    setStats(await adminApi.getReviewStats());
  };

  const handleRestore = async (review: AdminReview) => {
    setBusyId(review.id);
    setError('');
    try {
      await adminApi.restoreReview(review.id);
      await afterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the review');
    } finally {
      setBusyId(null);
    }
  };

  const askDelete = (review: AdminReview) =>
    confirm.ask({
      title: 'Delete this review?',
      message: `This hides the review by ${
        review.user.name || review.user.email || 'this customer'
      } on ${review.product.title} from customers. You can put it back from the Deleted list.`,
      confirmLabel: 'Delete review',
      onConfirm: async () => {
        await adminApi.deleteReview(review.id);
        await afterChange();
      },
    });

  const askDestroy = (review: AdminReview) =>
    confirm.ask({
      title: 'Delete permanently?',
      message: `This destroys the review by ${
        review.user.name || review.user.email || 'this customer'
      } on ${review.product.title}, along with any photographs attached to it. It cannot be recovered.`,
      confirmLabel: 'Delete for ever',
      onConfirm: async () => {
        await adminApi.destroyReview(review.id);
        await afterChange();
      },
    });

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="screen-header mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-stone-850">Customer Reviews Moderation Panel</h2>
            <p className="text-xs text-stone-500">
              Reviews publish as soon as a customer writes them. Take one down and it
              moves to Deleted, where it can be put back.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {stats.live} live
            </span>
            {stats.deleted > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                {stats.deleted} deleted
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.label}
                onClick={() => setShowDeleted(t.deleted)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  showDeleted === t.deleted
                    ? 'bg-[#064e3b] text-white border-[#064e3b]'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {t.label}
                <span className={showDeleted === t.deleted ? 'opacity-70' : 'text-stone-400'}>
                  {' '}
                  {t.deleted ? stats.deleted : stats.live}
                </span>
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
            {showDeleted
              ? 'Nothing has been taken down.'
              : search
                ? 'No reviews match that search.'
                : 'No reviews yet.'}
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
                    <td className="p-4 text-stone-600 max-w-[260px]">
                      {r.title && <div className="font-bold text-stone-800">{r.title}</div>}
                      <div className="line-clamp-2" title={r.comment ?? ''}>
                        {r.comment}
                      </div>

                      {/* Attachments, so a moderator can judge what was posted
                          rather than only the text. */}
                      {r.mediaUrls?.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {r.mediaUrls.map((url, idx) => {
                            const isVideo = r.mediaTypes?.[idx] === 'VIDEO';
                            const resolved = resolveImageUrl(url);
                            return (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setPreview({ url: resolved, isVideo })}
                                className="w-11 h-11 rounded border border-stone-200 overflow-hidden bg-stone-50 hover:border-[#064e3b] transition relative shrink-0"
                                title="View attachment"
                              >
                                {isVideo ? (
                                  <>
                                    <video src={resolved} className="w-full h-full object-cover" muted preload="metadata" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <Play className="h-3.5 w-3.5 text-white fill-white" />
                                    </span>
                                  </>
                                ) : (
                                  <img src={resolved} alt="" className="w-full h-full object-cover" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-stone-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="p-4">
                      {r.deletedAt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-600 whitespace-nowrap">
                          Deleted {formatDate(r.deletedAt)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          Live
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {busyId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-stone-400 ml-auto" />
                      ) : r.deletedAt ? (
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleRestore(r)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-1.5 rounded transition"
                            title="Put this review back on the product page"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                          {/* Only reachable from this list, so nothing can be
                              destroyed in one step from the published one. */}
                          <button
                            onClick={() => askDestroy(r)}
                            className="bg-red-50 hover:bg-red-100 text-red-800 p-1.5 rounded transition"
                            title="Delete permanently — cannot be undone"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => askDelete(r)}
                          className="bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-red-700 p-1.5 rounded transition ml-auto block"
                          title="Hide from customers — recoverable"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-5 mt-2 border-t border-stone-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-stone-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Attachment preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/85 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {preview.isVideo ? (
            <video
              src={preview.url}
              className="max-h-[85vh] max-w-full rounded-lg"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={preview.url}
              alt="Review attachment"
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
}
