import { useEffect } from 'react';

/**
 * Warns before losing work in progress.
 *
 * The console had no guard of any kind — no beforeunload, no navigation
 * block — so a stray back gesture or a closed tab silently discarded a long
 * product description or a half-built order edit, with no warning and no
 * draft. The storefront's forms are short enough that this hardly matters
 * there; here a single field can hold twenty minutes of writing.
 *
 * The browser controls the wording. Every modern browser ignores whatever
 * string you set and shows its own, so there is nothing to phrase — the only
 * decision this hook makes is *when* to interrupt someone, and interrupting a
 * person who has changed nothing is how a warning gets trained away.
 */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Still set for the handful of engines that read it; harmless otherwise.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
}
