/**
 * A fact only the business can supply, marked so it cannot go live unnoticed.
 *
 * These pages are assembled from what the code actually does — the delivery
 * threshold, the payment provider, what the account stores. The rest (a
 * licence number, a registered entity, a return window) is a decision, and
 * inventing one would put a false promise on a page customers are told to
 * trust. So it renders loudly instead of quietly reading as finished text.
 */
export default function Pending({ children }: { children: React.ReactNode }) {
  return (
    <mark
      data-pending-fact
      className="rounded-sm bg-[#FFF3CD] px-1.5 py-0.5 font-medium text-[#7A5A00] decoration-dotted underline-offset-2"
    >
      [{children}]
    </mark>
  );
}
