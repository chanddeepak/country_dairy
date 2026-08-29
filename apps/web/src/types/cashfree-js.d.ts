/**
 * Types for `@cashfreepayments/cashfree-js`, which ships none.
 *
 * Deliberately the minimum surface this codebase calls rather than a blanket
 * `any` — the same choice `RazorpayService` makes on the API side. An `any`
 * here would let a typo in `paymentSessionId` compile and fail silently in
 * front of a customer holding a card.
 *
 * If a wider surface is needed later, widen it here rather than casting at the
 * call site.
 */
declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeCheckoutOptions {
    /** From the server's create-order response. Short-lived. */
    paymentSessionId: string;
    /**
     * `_modal` keeps the customer on our page; `_self` navigates away to
     * Cashfree and returns via the order's `return_url`.
     */
    redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
  }

  export interface CashfreeCheckoutResult {
    /**
     * `code` is 'payment_aborted' when the customer answered "Yes, Leave" to
     * their own "Leaving Checkout?" prompt — captured from a real cancel, and
     * the only way to tell a decision from a silence.
     */
    error?: { code?: string; message?: string; type?: string };
    redirect?: boolean;
    paymentDetails?: { paymentMessage?: string };
  }

  export interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult | void>;
  }

  export function load(options: {
    mode: 'sandbox' | 'production';
  }): Promise<CashfreeInstance | null>;
}
