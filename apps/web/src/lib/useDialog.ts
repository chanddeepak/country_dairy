import { useEffect, useRef } from 'react';

/**
 * Makes a div behave like a dialog for someone using a keyboard.
 *
 * Without this the sign-in modal was unusable without a mouse: Tab walked
 * straight out of it into the page behind — "Open cart", "SHOP BY CATEGORY",
 * content the customer could not see because the modal was covering it — the
 * close button was never reached, and Escape did nothing. There was no
 * keyboard way to dismiss it at all short of reloading the page.
 *
 * Three things, which is what a dialog owes a keyboard user:
 *
 *   - focus moves in when it opens and returns to whatever opened it on close,
 *     so the reader is not dropped back at the top of the document;
 *   - Tab and Shift+Tab cycle within it rather than escaping behind it;
 *   - Escape closes it.
 *
 * Escape is deliberate and does not reopen the question of dismissing on an
 * outside click, which stays disabled: an outside click is usually a misclick,
 * a keypress is a decision.
 */
export function useDialog(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    // The first real control rather than the close button, so a customer who
    // opened this to sign in can start typing.
    const first = focusable();
    (first.find((el) => el.tagName === 'INPUT') ?? first[0] ?? ref.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (event.shiftKey && (active === firstItem || !ref.current?.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (active === lastItem || !ref.current?.contains(active))) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Back where they came from, if it is still on the page.
      if (previouslyFocused.current?.isConnected) previouslyFocused.current.focus();
    };
  }, [isOpen, onClose]);

  return ref;
}
