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
      <h4 className="font-serif font-black text-sm text-[#2A2A2A] uppercase tracking-wider flex items-center gap-2 border-b border-stone-200 pb-2">
        <span>🔬</span> Independent Lab Report
      </h4>

      <div className="rounded-2xl border border-stone-200/80 bg-[#FAF8F3]/80 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-stone-200/80">
          <div>
            <div className="text-xs font-bold text-[#2A2A2A]">
              Batch <span className="font-mono">{latest.batchNumber}</span>
            </div>
            <div className="text-[11px] text-[#6b6661] mt-0.5">
              Tested {formatDate(latest.testDate)}
              {latest.labName ? ` at ${latest.labName}` : ''}
            </div>
          </div>

          {latest.fileUrl && (
            <a
              href={resolveStorefrontImageUrl(latest.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#3A6038] hover:bg-[#2f4d2e] text-white text-[11px] font-bold transition-colors"
            >
              View signed report
            </a>
          )}
        </div>

        {latest.parameters.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-bold text-[#6b6661] uppercase tracking-wider">
                  <th className="px-4 py-2">Parameter</th>
                  <th className="px-4 py-2">Result</th>
                  <th className="px-4 py-2">Permissible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70">
                {latest.parameters.map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-bold text-[#2A2A2A]">{p.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-extrabold text-[#3A6038]">{p.value}</span>
                      {p.passed === false && (
                        <span className="ml-2 text-[10px] font-bold text-red-600">out of spec</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#6b6661]">{p.standard || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {latest.notes && (
          <p className="px-4 py-3 text-xs leading-relaxed text-[#6b6661] border-t border-stone-200/80">
            {latest.notes}
          </p>
        )}
      </div>

      {reports.length > 1 && (
        <p className="text-[11px] text-[#6b6661]">
          {reports.length - 1} earlier {reports.length === 2 ? 'batch has' : 'batches have'} also
          been tested. Scan the QR code on your jar to see the report for the batch you received.
        </p>
      )}
    </div>
  );
}
