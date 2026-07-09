interface StatusBadgeProps {
  status: string;
}

const BADGE_STYLES: Record<string, string> = {
  // Order statuses
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  SHIPPED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  
  // Payment statuses
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UNPAID: 'bg-stone-50 text-stone-600 border-stone-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',

  // QA Lab Certifications
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UNVERIFIED: 'bg-red-50 text-red-700 border-red-200',
  PENDING_CERT: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const upperStatus = status.toUpperCase();
  const style = BADGE_STYLES[upperStatus] || 'bg-stone-50 text-stone-600 border-stone-200';

  return (
    <span className={`inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style}`}>
      {status}
    </span>
  );
}
