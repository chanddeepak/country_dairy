'use client';

import { useCallback, useState } from 'react';
import { API_URL } from './constants';
import { PINCODE_PATTERN, normaliseState, type IndianState } from './indianStates';

export interface PincodeNote {
  ok: boolean;
  text: string;
}

export interface PincodeFill {
  district: string;
  state: IndianState | '';
}

/**
 * Looking a PIN code up, and saying so.
 *
 * Shared by checkout and the account page. They are two forms with different
 * field names for the same thing, and the moment there were two of them the
 * wording, the timeout and the "carry on anyway" behaviour started to be
 * decisions made twice. This is the half that is genuinely identical.
 *
 * Advisory throughout. Every failure path returns null and leaves a note the
 * customer can ignore — the form must stay usable when the lookup is slow,
 * down, or simply does not know a code.
 */
export function usePincodeLookup() {
  const [note, setNote] = useState<PincodeNote | null>(null);

  const check = useCallback(async (pincode: string): Promise<PincodeFill | null> => {
    if (pincode.length < 6) {
      setNote(null);
      return null;
    }

    if (!PINCODE_PATTERN.test(pincode)) {
      setNote({ ok: false, text: 'That does not look like a PIN code.' });
      return null;
    }

    setNote({ ok: true, text: 'Checking…' });

    try {
      const res = await fetch(`${API_URL}/geo/pincode/${pincode}`);

      if (!res.ok) {
        setNote({
          ok: false,
          text: 'We could not place that PIN code. Please fill in the town and state.',
        });
        return null;
      }

      const found = await res.json();
      const state = normaliseState(found.state);
      const district = typeof found.district === 'string' ? found.district : '';

      setNote({
        ok: true,
        text: [district, found.state].filter(Boolean).join(', '),
      });

      return { district, state };
    } catch {
      // Network trouble on our side, and not the customer's problem to solve.
      // No note at all: an error about our infrastructure, on a form asking
      // for their house number, reads as something they did wrong.
      setNote(null);
      return null;
    }
  }, []);

  return { note, setNote, check };
}
