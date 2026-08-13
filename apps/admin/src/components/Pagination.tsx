import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** What is being counted, for the summary line. */
  noun?: string;
}

/**
 * The pager for the admin lists.
 *
 * It always states the total, even on a single page. These lists previously
 * took a fixed slice and said nothing about it, so a console showing 200 orders
 * looked identical whether there were 200 or 2,000 — and the difference was
 * invisible precisely when it mattered most.
 */
export default function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  noun = 'rows',
}: PaginationProps) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3 border-t border-stone-200">
      <p className="text-xs text-stone-500 tabular-nums">
        Showing <span className="font-bold text-stone-700">{first}</span>–
        <span className="font-bold text-stone-700">{last}</span> of{' '}
        <span className="font-bold text-stone-700">{total.toLocaleString('en-IN')}</span> {noun}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="page-prev"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          <span className="px-3 text-xs font-bold text-stone-700 tabular-nums">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            data-testid="page-next"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent transition"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
