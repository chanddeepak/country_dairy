import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

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
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md transition-all animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl border border-stone-200/80 shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration bar */}
        <div className={`h-2 ${isDanger ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`} />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Top row: Icon & Close button */}
          <div className="flex items-start justify-between gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isDanger 
                ? 'bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-100' 
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
              {isDanger ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>

            <button
              onClick={onCancel}
              disabled={isLoading}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Title and Message Body */}
          <div className="space-y-2">
            <h3 className="text-lg font-serif font-bold text-stone-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line font-medium">
              {message}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
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
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  {isDanger && <Trash2 className="h-4 w-4" />}
                  <span>{confirmLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
