import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * The one overlay.
 *
 * There were ten hand-rolled ones in this console and exactly one of them
 * closed on Escape — every other dialog trapped the reader until they found
 * the right pixel with a mouse. That is what duplicating a backdrop nine
 * times actually costs: not the markup, but the behaviour nobody remembers to
 * repeat.
 *
 * Everything overlaying the page should be built from this: confirmations,
 * editors, previews, drawers. It owns the backdrop, Escape, click-outside and
 * the scroll lock, so a caller only decides what goes inside.
 */

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Rendered in the header. Omit for a bare panel that draws its own. */
  title?: string;
  description?: string;
  size?: keyof typeof WIDTHS;
  /**
   * Set while something irreversible is in flight. Escape, the backdrop and
   * the close button all stop working — a half-finished delete should not be
   * dismissable into an unknown state.
   */
  busy?: boolean;
  /** Suppresses the header entirely, for panels that are all content. */
  hideHeader?: boolean;
  children: ReactNode;
  /** Pinned to the bottom, outside the scrolling area. */
  footer?: ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  busy = false,
  hideHeader = false,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll under the overlay — on a long table it
    // is disorienting to dismiss a dialog and find yourself somewhere else.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Without this a click on the panel reaches the backdrop and closes
        // the thing the reader is using.
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl border border-stone-200/80 shadow-2xl w-full ${WIDTHS[size]} max-h-[85vh] flex flex-col overflow-hidden`}
      >
        {!hideHeader && (title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-stone-100">
            <div className="min-w-0">
              {title && (
                <h3 className="text-base font-serif font-bold text-stone-900 tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-stone-500 mt-0.5">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="shrink-0 p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50">{footer}</div>
        )}
      </div>
    </div>
  );
}
