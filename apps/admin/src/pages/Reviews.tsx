import { useState } from 'react';
import { Star, ShieldAlert, Check, Trash2 } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

interface Review {
  id: string;
  product: string;
  customer: string;
  rating: number;
  comment: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const SEED_REVIEWS: Review[] = [
  { id: '1', product: 'Country Dairy A2 Cow Milk', customer: 'Amit Sharma', rating: 5, comment: 'Extremely fresh and delicious milk! Our family loves it daily.', date: 'July 5, 2026', status: 'PENDING' },
  { id: '2', product: 'Organic Wood-Pressed Mustard Oil', customer: 'Rohan Malhotra', rating: 4, comment: 'Pungent aroma, genuine wood-pressed oil. Great for cooking.', date: 'July 5, 2026', status: 'PENDING' },
  { id: '3', product: 'Raw Wild Forest Honey', customer: 'Priya Sen', rating: 5, comment: 'Excellent honey quality, pure and unfiltered.', date: 'July 4, 2026', status: 'APPROVED' },
];

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>(SEED_REVIEWS);

  const handleAction = (id: string, action: 'APPROVED' | 'REJECTED') => {
    const updated = reviews.map(r => r.id === id ? { ...r, status: action } : r);
    setReviews(updated);
    alert(`Review marked as ${action.toLowerCase()}!`);
  };

  const handleDelete = (id: string) => {
    const updated = reviews.filter(r => r.id !== id);
    setReviews(updated);
    alert('Review deleted permanently.');
  };

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="screen-header mb-6">
          <h2 className="text-lg font-bold text-stone-850">Customer Reviews Moderation Panel</h2>
          <p className="text-xs text-stone-500">Approve or reject customer review entries prior to storefront publication.</p>
        </div>

        <table className="data-table w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 font-bold text-xs uppercase bg-stone-50/50">
              <th className="p-4">Product Name</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Rating</th>
              <th className="p-4">Review Comment</th>
              <th className="p-4">Post Date</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Moderation Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map(r => (
              <tr key={r.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/20 transition-colors text-sm">
                <td className="p-4 font-bold text-stone-800">{r.product}</td>
                <td className="p-4 text-stone-700 font-medium">{r.customer}</td>
                <td className="p-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <Star key={idx} className={`h-3.5 w-3.5 ${
                        idx < r.rating ? 'fill-[#C59B27] text-[#C59B27]' : 'text-stone-200'
                      }`} />
                    ))}
                  </div>
                </td>
                <td className="p-4 text-stone-600 line-clamp-1 max-w-[240px]" title={r.comment}>{r.comment}</td>
                <td className="p-4 text-stone-500">{r.date}</td>
                <td className="p-4">
                  <StatusBadge status={r.status} />
                </td>
                <td className="p-4 text-right">
                  {r.status === 'PENDING' ? (
                    <div className="flex gap-1.5 justify-end">
                      <button 
                        onClick={() => handleAction(r.id, 'APPROVED')}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-1.5 rounded transition"
                        title="Approve Review"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleAction(r.id, 'REJECTED')}
                        className="bg-red-50 hover:bg-red-100 text-red-800 p-1.5 rounded transition"
                        title="Flag / Reject Review"
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleDelete(r.id)}
                      className="bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-red-700 p-1.5 rounded transition ml-auto block"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
