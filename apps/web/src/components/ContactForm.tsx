'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { API_URL } from '../lib/constants';

/**
 * The contact form, for anyone at all.
 *
 * Deliberately does not require an account. The people most likely to have a
 * question — does this reach my town, is it really A2, how long does it keep —
 * are the ones who have not bought anything yet, and a form that demands a
 * sign-up turns away exactly those people.
 *
 * A submission opens a ticket in the console alongside order queries, so it
 * lands in the same inbox rather than a mailbox nobody watches.
 */
export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setNote('');

    try {
      const res = await fetch(`${API_URL}/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // The API returns one message per failed rule. Showing the first is
        // enough to act on; showing all of them reads as a telling-off.
        setNote(
          Array.isArray(data?.message)
            ? data.message[0]
            : data?.message ?? 'Could not send that. Please try again.',
        );
        return;
      }

      setSent(true);
      setNote(`Thank you — your reference is ${data.ticketRef}. We will reply by email.`);
      setForm({ name: '', email: '', subject: '', body: '' });
    } catch {
      setNote('Could not reach us just now. Please try again, or use WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  const field =
    'w-full bg-white/8 border border-white/18 text-[var(--ivory)] placeholder:text-[var(--sand)]/60 ' +
    'px-3 py-2.5 rounded-sm text-sm focus:outline-none focus:border-[var(--brass)]';

  return (
    <form onSubmit={submit} className="space-y-2.5" data-testid="contact-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          required
          value={form.name}
          onChange={set('name')}
          placeholder="Your name"
          data-testid="contact-name"
          className={field}
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="Email"
          data-testid="contact-email"
          className={field}
        />
      </div>

      <input
        required
        value={form.subject}
        onChange={set('subject')}
        placeholder="What is it about?"
        data-testid="contact-subject"
        className={field}
      />

      <textarea
        required
        rows={3}
        value={form.body}
        onChange={set('body')}
        placeholder="Your question"
        data-testid="contact-body"
        className={`${field} resize-none`}
      />

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-2 bg-[var(--brass)] hover:bg-[var(--forest)] text-[#1a1405] hover:text-[var(--ivory)] font-bold text-xs px-4 py-2.5 rounded-sm disabled:opacity-60 transition"
      >
        <Send className="h-3.5 w-3.5" />
        {sending ? 'Sending…' : 'Send'}
      </button>

      {note && (
        <p className={`text-[11px] ${sent ? 'text-[var(--ok-on-dark)]' : 'text-[var(--brass-on-dark)]'}`}>{note}</p>
      )}
    </form>
  );
}
