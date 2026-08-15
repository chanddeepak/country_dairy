import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle, Package, RefreshCw, Search, Send } from 'lucide-react';
import { adminApi } from '../services/apiClient';
import Pagination from '../components/Pagination';
import OrderPeekModal from '../components/support/OrderPeekModal';
import type { SupportStatus, SupportTicket } from '../types';

/**
 * The customer query inbox.
 *
 * Support used to happen entirely on WhatsApp, which is immediate but leaves
 * no record — nobody could see what was asked last week, whether anyone
 * answered, or how often the same thing comes up. A ticket keeps the thread
 * against the order it is about.
 */

/** Open first, then the ones waiting on the customer, then anything settled. */
const FILTERS: { key: SupportStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Needs a reply' },
  { key: 'AWAITING_CUSTOMER', label: 'Waiting on customer' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

const STATUS_STYLE: Record<SupportStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  AWAITING_CUSTOMER: 'bg-sky-100 text-sky-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-stone-200 text-stone-600',
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN: 'Needs a reply',
  AWAITING_CUSTOMER: 'Waiting on customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

function when(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [status, setStatus] = useState<SupportStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, pageSize: 50 });

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  /** Separate from error: a success in a red box reads as a failure. */
  const [notice, setNotice] = useState('');

  /**
   * Show the row straight away, then fill in what the list did not carry.
   *
   * The row is enough to read the conversation, so it goes up immediately
   * rather than making the desk wait on a second request. Only the order
   * panel needs the rest, and it is behind another click.
   */
  const openTicket = async (ticket: SupportTicket) => {
    setSelected(ticket);
    setDraft('');
    setPeeking(false);

    try {
      const full = await adminApi.getTicket(ticket.id);
      // Guard against a slow response landing after the desk has moved on to
      // a different thread.
      setSelected((prev) => (prev?.id === full.id ? full : prev));
    } catch {
      // Not worth an error banner: everything except the order breakdown is
      // already on screen and the conversation is perfectly usable without it.
    }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await adminApi.getTickets({
        status: status === 'ALL' ? undefined : status,
        search: search || undefined,
        page,
      });
      setTickets(result.items);
      setPageInfo({
        total: result.total,
        totalPages: result.totalPages,
        pageSize: result.pageSize,
      });

      // Keep the open thread in step with what was just fetched, so a reply
      // shows without the desk having to reselect the ticket.
      setSelected((prev) => {
        if (!prev) return prev;
        const fresh = result.items.find((t) => t.id === prev.id);
        if (!fresh) return prev;
        // The list has newer messages and status, but never line items. Taking
        // it wholesale would empty the order panel a moment after it filled.
        return { ...fresh, order: fresh.order ? { ...fresh.order, ...prev.order } : prev.order };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load queries');
    } finally {
      setIsLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const sendReply = async () => {
    if (!selected || !draft.trim()) return;
    setIsSending(true);
    setError('');
    setNotice('');
    try {
      await adminApi.replyToTicket(selected.id, draft.trim());
      setDraft('');
      await load();
      // Replying moves the ticket to "waiting on customer", so under the
      // "needs a reply" filter it leaves the list while its thread stays open
      // beside an empty column. Worth saying rather than looking broken.
      if (status === 'OPEN') {
        setNotice('Replied. It has moved to “Waiting on customer”.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that reply');
    } finally {
      setIsSending(false);
    }
  };

  const changeStatus = async (next: SupportStatus) => {
    if (!selected) return;
    setError('');
    try {
      await adminApi.setTicketStatus(selected.id, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that status');
    }
  };

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#064e3b]" />
            <h1 className="text-xl font-serif font-bold">Customer Queries</h1>
          </div>

          {/* Queries arrive while the page is open, and nothing pushes them
              here — without this the only way to see a new one is to reload
              the browser and lose your place. */}
          <button
            type="button"
            data-testid="refresh-queries"
            onClick={() => void load()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#064e3b] border border-[#064e3b]/25 rounded-lg hover:bg-[#064e3b] hover:text-white disabled:opacity-50 transition-colors"
            title="Check for new queries"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-[#6b6661]">
          Questions raised from a customer&apos;s order page. Replying here writes back to the
          same thread they are reading.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              data-testid={`ticket-filter-${f.key.toLowerCase()}`}
              onClick={() => setStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                status === f.key
                  ? 'bg-[#064e3b] text-white border-[#064e3b]'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-[#064e3b]'
              }`}
            >
              {f.label}
            </button>
          ))}

          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference, subject, customer or order"
              className="pl-8 pr-3 py-1.5 w-72 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-[#064e3b]"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {error}
          </p>
        )}

        {notice && (
          <p className="mt-3 text-xs font-bold text-[#064e3b] bg-[#064e3b]/5 border border-[#064e3b]/20 rounded-lg p-2.5">
            {notice}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-stone-500 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading queries…
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 px-6 text-center text-xs text-stone-500 font-medium">
              {status === 'ALL' && !search ? (
                'No queries yet. That is a good sign.'
              ) : (
                <>
                  Nothing matches this filter.
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('ALL');
                      setSearch('');
                    }}
                    className="block mx-auto mt-2 font-bold text-[#064e3b] hover:underline"
                  >
                    Show all queries
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-stone-100 max-h-[32rem] overflow-y-auto">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid="ticket-row"
                  onClick={() => openTicket(t)}
                  className={`w-full text-left px-5 py-4 hover:bg-stone-50 transition ${
                    selected?.id === t.id ? 'bg-stone-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-stone-500">
                      {t.ticketRef}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <div className="font-bold text-sm mt-1 truncate">{t.subject}</div>
                  <div className="text-[11px] text-stone-500 mt-0.5 truncate">
                    {t.user?.name ?? 'Customer'}
                    {t.order ? ` · ${t.order.orderNumber}` : ''} · {when(t.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          )}

          <Pagination
            page={page}
            pageSize={pageInfo.pageSize}
            total={pageInfo.total}
            totalPages={pageInfo.totalPages}
            onPageChange={setPage}
            noun="queries"
          />
        </div>

        {/* Thread */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200/80 shadow-sm">
          {!selected ? (
            <div className="py-24 text-center text-xs text-stone-500 font-medium">
              Pick a query to read it.
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-stone-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-base truncate">{selected.subject}</h2>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {selected.ticketRef} · {selected.user?.name ?? 'Customer'}
                      {selected.user?.email ? ` · ${selected.user.email}` : ''}
                      {selected.order ? ` · order ${selected.order.orderNumber}` : ''}
                    </p>
                  </div>

                  <select
                    value={selected.status}
                    data-testid="ticket-status"
                    onChange={(e) => changeStatus(e.target.value as SupportStatus)}
                    className="bg-white border border-stone-200 px-2.5 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:border-[#064e3b]"
                  >
                    {(Object.keys(STATUS_LABEL) as SupportStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selected.order && (
                /* The question is usually about this. Having to leave the
                   thread to find out what was bought is how a two-minute
                   reply becomes a five-minute one. */
                <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
                  <span className="font-bold text-[#064e3b]">{selected.order.orderNumber}</span>
                  <span className="text-stone-600">{selected.order.status}</span>
                  <span className="text-stone-600">
                    ₹{Number(selected.order.totalAmount).toLocaleString('en-IN')}
                  </span>
                  {selected.user?.phone && (
                    <a
                      href={`tel:${selected.user.phone}`}
                      className="text-[#064e3b] font-bold hover:underline"
                    >
                      {selected.user.phone}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPeeking(true)}
                    className="ml-auto inline-flex items-center gap-1 font-bold text-[#064e3b] hover:underline"
                  >
                    <Package className="h-3 w-3" />
                    What was ordered
                  </button>
                </div>
              )}

              {!selected.user && selected.contactEmail && (
                /* A guest query has no account behind it, so the reply address
                   is the only way back to them. */
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-900">
                  From the contact form · reply to{' '}
                  <a href={`mailto:${selected.contactEmail}`} className="font-bold hover:underline">
                    {selected.contactEmail}
                  </a>
                </div>
              )}

              <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] ${m.fromStaff ? 'ml-auto text-right' : ''}`}
                  >
                    <div
                      className={`inline-block px-3.5 py-2.5 rounded-xl text-sm whitespace-pre-wrap text-left ${
                        m.fromStaff
                          ? 'bg-[#064e3b] text-white'
                          : 'bg-stone-100 text-[#2A2A2A]'
                      }`}
                    >
                      {m.body}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-1">
                      {m.authorName} · {when(m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>

              {selected.status === 'CLOSED' ? (
                <p className="p-5 border-t border-stone-100 text-xs text-stone-500">
                  This query is closed. Reopen it above to reply.
                </p>
              ) : (
                <div className="p-5 border-t border-stone-100 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    data-testid="ticket-reply"
                    placeholder="Write a reply…"
                    className="flex-1 bg-white border border-stone-200 px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:border-[#064e3b]"
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={isSending || !draft.trim()}
                    className="flex items-center gap-1.5 bg-[#064e3b] hover:bg-[#053d2f] text-white font-bold px-4 py-2.5 rounded-lg text-xs disabled:opacity-50 transition"
                  >
                    {isSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Reply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {peeking && selected?.order && (
        <OrderPeekModal order={selected.order} onClose={() => setPeeking(false)} />
      )}
    </div>
  );
}
