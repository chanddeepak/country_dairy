'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/layout/Navbar';
import Footer from '../../../components/layout/Footer';
import CartDrawer from '../../../components/cart/CartDrawer';
import AuthModal from '../../../components/modals/AuthModal';
import { API_URL, resolveStorefrontImageUrl } from '../../../lib/constants';
import type { LabParameter } from '../../../components/product/LabReportPanel';

interface BatchReport {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  batchNumber: string;
  testDate: string;
  labName: string | null;
  fileUrl: string | null;
  notes: string | null;
  parameters: LabParameter[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Where the QR code on the jar lands.
 *
 * A customer holding the jar types nothing and knows only the batch printed on
 * the label, so this resolves by batch number alone and shows the results for
 * the jar in their hand rather than the newest batch we have tested.
 */
export default function BatchPurityPage() {
  const params = useParams();
  const router = useRouter();
  const batch = decodeURIComponent(String(params?.batch ?? ''));

  const [report, setReport] = useState<BatchReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'missing'>('loading');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    if (!batch) return;

    let cancelled = false;

    fetch(`${API_URL}/lab-reports/batch/${encodeURIComponent(batch)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not found');
        return (await res.json()) as BatchReport;
      })
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setStatus('found');
      })
      .catch(() => {
        if (!cancelled) setStatus('missing');
      });

    return () => {
      cancelled = true;
    };
  }, [batch]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F3]">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔬</div>
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-[#2A2A2A] mb-2">
            Batch Purity Report
          </h1>
          <p className="text-sm text-[#6b6661]">
            Results for batch <span className="font-mono font-bold">{batch}</span>
          </p>
        </div>

        {status === 'loading' && (
          <div className="py-16 text-center text-sm text-[#6b6661] animate-pulse">
            Looking up this batch…
          </div>
        )}

        {status === 'missing' && (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center">
            <h2 className="font-serif font-bold text-lg text-[#2A2A2A] mb-2">
              No report for this batch
            </h2>
            <p className="text-sm text-[#6b6661] leading-relaxed max-w-md mx-auto">
              We could not find a published lab report for{' '}
              <span className="font-mono font-bold">{batch}</span>. Check the code printed on your
              jar, or write to us and we will send the report for your batch directly.
            </p>
            <Link
              href="/products"
              className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold transition-colors"
            >
              Browse products
            </Link>
          </div>
        )}

        {status === 'found' && report && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-serif font-bold text-[#2A2A2A]">{report.productTitle}</div>
                  <div className="text-xs text-[#6b6661] mt-0.5">
                    Tested {formatDate(report.testDate)}
                    {report.labName ? ` at ${report.labName}` : ''}
                  </div>
                </div>

                {report.fileUrl && (
                  <a
                    href={resolveStorefrontImageUrl(report.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-xs font-bold transition-colors"
                  >
                    View signed report
                  </a>
                )}
              </div>

              {report.parameters.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-[#6b6661] uppercase tracking-wider bg-[#FAF8F3]/60">
                        <th className="px-5 py-2.5">Parameter</th>
                        <th className="px-5 py-2.5">Result</th>
                        <th className="px-5 py-2.5">Permissible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/70">
                      {report.parameters.map((p, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3 font-bold text-[#2A2A2A] text-xs">{p.name}</td>
                          <td className="px-5 py-3">
                            <span className="font-mono font-extrabold text-[#3A6038] text-xs">
                              {p.value}
                            </span>
                            {p.passed === false && (
                              <span className="ml-2 text-[10px] font-bold text-red-600">
                                out of spec
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-[#6b6661] text-xs">{p.standard || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.notes && (
                <p className="px-5 py-4 text-xs leading-relaxed text-[#6b6661] border-t border-stone-200/80">
                  {report.notes}
                </p>
              )}
            </div>

            <Link
              href={`/products/${report.productSlug}`}
              className="block text-center px-5 py-3 rounded-xl border border-stone-200 bg-white hover:bg-[#FAF8F3] text-xs font-bold text-[#2A2A2A] transition-colors"
            >
              See {report.productTitle}
            </Link>
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => router.push('/checkout')}
      />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
