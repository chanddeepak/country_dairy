import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Are you sure?", built on Modal rather than on its own backdrop.
 *
 * It used to draw its own, which is how it ended up as the only dialog in the
 * console that did not close on Escape. Everything overlaying the page now
 * shares one implementation of that behaviour.
 *
 * Prefer reaching for this through useConfirm — it owns the open state, the
 * busy flag and the closing, which is the part every page kept getting
 * subtly wrong.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      // Escape and the backdrop stop working while the work is in flight, so a
      // half-finished delete cannot be dismissed into an unknown state.
      busy={isLoading}
      hideHeader
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/25'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {/* Named after the button rather than a hardcoded "Deleting…",
                    which was a small lie on every dialog that was not a
                    delete. */}
                <span>Working…</span>
              </>
            ) : (
              <>
                {isDanger && <Trash2 className="h-4 w-4" />}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="p-6 sm:p-7 space-y-5">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
            isDanger
              ? 'bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-100'
              : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}
        >
          {isDanger ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-serif font-bold text-stone-900 tracking-tight">{title}</h3>
          <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line font-medium">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}
