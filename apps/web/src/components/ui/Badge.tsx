'use client';

import React from 'react';

/**
 * Order status as four tones rather than six hues.
 *
 * The previous map gave CONFIRMED blue, PROCESSING amber, SHIPPED indigo,
 * DELIVERED emerald, REFUNDED purple — six unrelated colours on a warm ivory
 * page, none of which told you anything the word beside them did not. Status is
 * a progression, so it reads as one: waiting, moving, done, wrong.
 *
 * The label still carries the detail. Colour only has to answer whether this
 * needs attention.
 */
const WAITING = 'bg-[var(--cream)] text-[var(--ink-soft)] border-[var(--line)]';
const MOVING = 'bg-[var(--warn-bg)] text-[var(--warn)] border-[var(--warn-line)]';
const DONE = 'bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--ok-line)]';
const WRONG = 'bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-line)]';

const STATUS_STYLES: Record<string, string> = {
  PENDING: WAITING,
  REFUNDED: WAITING,
  PAUSED: WAITING,

  CONFIRMED: MOVING,
  PROCESSING: MOVING,
  SHIPPED: MOVING,

  DELIVERED: DONE,
  PAID: DONE,
  ACTIVE: DONE,

  CANCELLED: WRONG,
  FAILED: WRONG,
};

interface BadgeProps {
  status: string;
  className?: string;
}

export default function Badge({ status, className = '' }: BadgeProps) {
  // An unknown status sits on the page rather than on top of it.
  const style = STATUS_STYLES[status] || WAITING;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${style} ${className}`}
    >
      {status}
    </span>
  );
}
