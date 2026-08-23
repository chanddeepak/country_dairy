'use client';

import { FlaskConical } from 'lucide-react';

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
    <div className="flex flex-col min-h-screen bg-[var(--ivory)]">
      <Navbar onCartOpen={() => setIsCartOpen(true)} onAuthOpen={() => setIsAuthOpen(true)} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-8">
          <FlaskConical className="mx-auto mb-3 h-9 w-9 text-[var(--brass)]" strokeWidth={1.25} />
          <h1 className="font-serif font-light text-2xl sm:text-3xl text-[var(--ink)] mb-2">
            Batch Purity Report
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Results for batch <span className="font-mono font-bold">{batch}</span>
          </p>
        </div>

        {status === 'loading' && (
          <div className="py-16 text-center text-sm text-[var(--ink-soft)] animate-pulse">
            Looking up this batch…
          </div>
        )}

        {status === 'missing' && (
          <div className="bg-white rounded-sm border border-[var(--line)]/80 p-8 text-center">
            <h2 className="font-serif font-normal text-lg text-[var(--ink)] mb-2">
              No report for this batch
            </h2>
            <p className="text-sm text-[var(--ink-soft)] leading-relaxed max-w-md mx-auto">
              We could not find a published lab report for{' '}
              <span className="font-mono font-bold">{batch}</span>. Check the code printed on your
              jar, or write to us and we will send the report for your batch directly.
            </p>
            <Link
              href="/products"
              className="inline-block mt-5 px-5 py-2.5 rounded-sm bg-[var(--forest)] hover:bg-[var(--pine)] text-white text-xs font-bold transition-colors"
            >
              Browse products
            </Link>
          </div>
        )}

        {status === 'found' && report && (
          <div className="space-y-5">
            <div className="bg-white rounded-sm border border-[var(--line)]/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--line)]/80 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-serif font-normal text-[var(--ink)]">{report.productTitle}</div>
                  <div className="text-xs text-[var(--ink-soft)] mt-0.5">
                    Tested {formatDate(report.testDate)}
                    {report.labName ? ` at ${report.labName}` : ''}
                  </div>
                </div>

                {report.fileUrl && (
                  <a
                    href={resolveStorefrontImageUrl(report.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-sm bg-[var(--forest)] hover:bg-[var(--pine)] text-white text-xs font-bold transition-colors"
                  >
                    View signed report
                  </a>
                )}
              </div>

              {report.parameters.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider bg-[var(--ivory)]/60">
                        <th className="px-5 py-2.5">Parameter</th>
                        <th className="px-5 py-2.5">Result</th>
                        <th className="px-5 py-2.5">Permissible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]/70">
                      {report.parameters.map((p, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3 font-bold text-[var(--ink)] text-xs">{p.name}</td>
                          <td className="px-5 py-3">
                            <span className="font-mono font-extrabold text-[var(--forest)] text-xs">
                              {p.value}
                            </span>
                            {p.passed === false && (
                              <span className="ml-2 text-[10px] font-bold text-[var(--danger)]">
                                out of spec
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-[var(--ink-soft)] text-xs">{p.standard || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.notes && (
                <p className="px-5 py-4 text-xs leading-relaxed text-[var(--ink-soft)] border-t border-[var(--line)]/80">
                  {report.notes}
                </p>
              )}
            </div>

            <Link
              href={`/products/${report.productSlug}`}
              className="block text-center px-5 py-3 rounded-sm border border-[var(--line)] bg-white hover:bg-[var(--ivory)] text-xs font-bold text-[var(--ink)] transition-colors"
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
