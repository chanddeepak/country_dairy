'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

interface SupportMessage {
  id: string;
  authorName: string;
  fromStaff: boolean;
  body: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  ticketRef: string;
  subject: string;
  status: 'OPEN' | 'AWAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  order?: { id: string; orderNumber: string } | null;
  messages: SupportMessage[];
}

/** What the customer is told, which is not what the inbox calls it. */
const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  OPEN: 'With us',
  AWAITING_CUSTOMER: 'Replied — over to you',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_STYLE: Record<SupportTicket['status'], string> = {
  OPEN: 'bg-amber-50 text-amber-800 border-amber-200',
  AWAITING_CUSTOMER: 'bg-[#3A6038]/10 text-[#3A6038] border-[#3A6038]/25',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-stone-100 text-stone-500 border-stone-200',
};

function when(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Where a customer reads the answer to what they asked.
 *
 * Without this the support feature was half a loop: a question could be sent
 * and a reply written, and the person who asked would never see it. A thread
 * they can return to is the point — that is what WhatsApp alone never gave.
 */
export default function QueriesTab({
  authFetch,
}: {
  authFetch: (path: string, init?: RequestInit) => Promise<Response | null>;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/support');
      if (!res?.ok) return;
      setTickets(await res.json());
    } catch {
      setNote('Could not load your questions just now.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const reply = async (ticketId: string) => {
    if (!draft.trim()) return;
    setSending(true);
    setNote('');
    try {
      const res = await authFetch(`/support/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!res?.ok) {
        setNote('Could not send that. Please try again.');
        return;
      }
      setDraft('');
      await load();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
            <div className="h-4 w-2/5 rounded bg-stone-200/80" />
            <div className="h-3 w-1/4 rounded bg-stone-200/80" />
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
        <MessageCircle className="h-8 w-8 text-stone-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-[#2A2A2A]">You have not asked us anything yet.</p>
        <p className="text-xs text-[#6b6661] mt-1">
          Open any order and press Need Help, and the conversation will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {note && (
        <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {note}
        </p>
      )}

      {tickets.map((ticket) => {
        const isOpen = openId === ticket.id;
        const latest = ticket.messages[ticket.messages.length - 1];

        return (
          <div key={ticket.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <button
              type="button"
              data-testid="query-row"
              onClick={() => {
                setOpenId(isOpen ? null : ticket.id);
                setDraft('');
              }}
              className="w-full text-left p-5 hover:bg-stone-50/60 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#2A2A2A] truncate">{ticket.subject}</p>
                  <p className="text-[11px] text-[#6b6661] mt-0.5">
                    {ticket.ticketRef}
                    {ticket.order ? ` · order ${ticket.order.orderNumber}` : ''} ·{' '}
                    {when(ticket.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLE[ticket.status]}`}
                >
                  {STATUS_LABEL[ticket.status]}
                </span>
              </div>

              {!isOpen && latest && (
                <p className="text-xs text-[#6b6661] mt-2 line-clamp-1">
                  {latest.fromStaff ? 'Country Dairy: ' : 'You: '}
                  {latest.body}
                </p>
              )}
            </button>

            {isOpen && (
              <div className="border-t border-stone-100 p-5 space-y-4">
                {ticket.messages.map((m) => (
                  <div key={m.id} className={m.fromStaff ? '' : 'text-right'}>
                    <div
                      className={`inline-block text-left px-3.5 py-2.5 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap ${
                        m.fromStaff
                          ? 'bg-[#3A6038] text-white'
                          : 'bg-stone-100 text-[#2A2A2A]'
                      }`}
                    >
                      {m.body}
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {m.fromStaff ? 'Country Dairy' : 'You'} · {when(m.createdAt)}
                    </p>
                  </div>
                ))}

                {ticket.status === 'CLOSED' ? (
                  <p className="text-xs text-[#6b6661]">
                    This conversation is closed. Ask a new question and quote {ticket.ticketRef}.
                  </p>
                ) : (
                  <div className="flex items-end gap-2 pt-1">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      data-testid="query-reply"
                      placeholder="Write back…"
                      className="flex-1 bg-[#FAF8F3] border border-stone-200 px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:border-[#3A6038]"
                    />
                    <button
                      type="button"
                      onClick={() => reply(ticket.id)}
                      disabled={sending || !draft.trim()}
                      className="inline-flex items-center gap-1.5 bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-50 transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
