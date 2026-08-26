'use client';

import { useEffect, useState } from 'react';
import { API_URL, resolveStorefrontImageUrl } from '@/lib/constants';

export interface LabParameter {
  name: string;
  value: string;
  standard?: string;
  passed?: boolean;
}

export interface LabReport {
  id: string;
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
 * Batch test results for a product.
 *
 * Renders nothing at all when no report has been published. The page makes
 * strong purity claims elsewhere; a "lab tested" panel with no lab behind it
 * would be the one part of that copy a customer could check and disprove.
 */
export default function LabReportPanel({ productId }: { productId?: string }) {
  const [reports, setReports] = useState<LabReport[]>([]);

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;

    fetch(`${API_URL}/lab-reports/product/${encodeURIComponent(productId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LabReport[]) => {
        if (!cancelled && Array.isArray(data)) setReports(data);
      })
      .catch(() => {
        // A failed fetch leaves the panel hidden rather than showing an error
        // box in the middle of the product story.
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const latest = reports[0];
  if (!latest) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-serif font-light text-sm text-[var(--ink)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--line)] pb-2">
        Independent Lab Report
      </h4>

      <div className="rounded-sm border border-[rgb(var(--line-rgb)/0.8)] bg-[rgb(var(--ivory-rgb)/0.8)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[rgb(var(--line-rgb)/0.8)]">
          <div>
            <div className="text-xs font-bold text-[var(--ink)]">
              Batch <span className="font-mono">{latest.batchNumber}</span>
            </div>
            <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
              Tested {formatDate(latest.testDate)}
              {latest.labName ? ` at ${latest.labName}` : ''}
            </div>
          </div>

          {latest.fileUrl && (
            <a
              href={resolveStorefrontImageUrl(latest.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-sm bg-[var(--forest)] hover:bg-[var(--pine)] text-white text-[11px] font-bold transition-colors"
            >
              View signed report
            </a>
          )}
        </div>

        {latest.parameters.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">
                  <th className="px-4 py-2">Parameter</th>
                  <th className="px-4 py-2">Result</th>
                  <th className="px-4 py-2">Permissible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line-rgb)/0.7)]">
                {latest.parameters.map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-bold text-[var(--ink)]">{p.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-extrabold text-[var(--forest)]">{p.value}</span>
                      {p.passed === false && (
                        <span className="ml-2 text-[10px] font-bold text-[var(--danger)]">out of spec</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--ink-soft)]">{p.standard || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {latest.notes && (
          <p className="px-4 py-3 text-xs leading-relaxed text-[var(--ink-soft)] border-t border-[rgb(var(--line-rgb)/0.8)]">
            {latest.notes}
          </p>
        )}
      </div>

      {reports.length > 1 && (
        <p className="text-[11px] text-[var(--ink-soft)]">
          {reports.length - 1} earlier {reports.length === 2 ? 'batch has' : 'batches have'} also
          been tested. Scan the QR code on your jar to see the report for the batch you received.
        </p>
      )}
    </div>
  );
}
