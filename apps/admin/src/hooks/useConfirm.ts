import { useCallback, useState } from 'react';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  /** Awaited. Throw to report failure; the dialog closes either way. */
  onConfirm: () => Promise<void> | void;
}

/**
 * Asking "are you sure", without writing the same five pieces of state again.
 *
 * Every page that deleted anything had grown its own `pendingDelete`, its own
 * `isDeleting`, its own handler that closed the dialog on success and forgot
 * to on failure — which left the error message rendered behind an open dialog,
 * where nobody could read it. Two pages had also simply never passed the busy
 * flag, so the click looked ignored while the request was in flight.
 *
 * Those are not decisions worth taking twice. The caller supplies the words
 * and the work; this owns the rest.
 *
 *   const confirm = useConfirm(setError);
 *   ...
 *   onClick={() => confirm.ask({
 *     title: 'Delete this review?',
 *     message: 'You can put it back from the Deleted list.',
 *     confirmLabel: 'Delete review',
 *     onConfirm: () => adminApi.deleteReview(r.id).then(reload),
 *   })}
 *   ...
 *   <ConfirmDialog {...confirm.dialogProps} />
 */
export function useConfirm(onError?: (message: string) => void) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const ask = useCallback((next: ConfirmRequest) => setRequest(next), []);

  const cancel = useCallback(() => {
    // Never abandon a request that is already in flight: the reader would be
    // left believing they had stopped something that is still happening.
    if (!isRunning) setRequest(null);
  }, [isRunning]);

  const run = useCallback(async () => {
    if (!request) return;
    setIsRunning(true);
    try {
      await request.onConfirm();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      // Closed whichever way it went. A failure behind an open dialog is a
      // failure nobody sees.
      setRequest(null);
      setIsRunning(false);
    }
  }, [request, onError]);

  return {
    ask,
    isRunning,
    /** Spread straight onto ConfirmDialog. */
    dialogProps: {
      isOpen: !!request,
      title: request?.title ?? '',
      message: request?.message ?? '',
      confirmLabel: request?.confirmLabel,
      variant: request?.variant,
      isLoading: isRunning,
      onConfirm: run,
      onCancel: cancel,
    },
  };
}
