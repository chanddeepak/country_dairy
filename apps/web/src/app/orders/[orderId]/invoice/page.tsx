'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';

interface InvoiceLine {
  description: string;
  variant: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  orderDate: string;
  isTaxInvoice: boolean;
  taxKind: 'CGST_SGST' | 'IGST';
  placeOfSupply: string;
  seller: Record<string, string>;
  buyer: Record<string, string>;
  lines: InvoiceLine[];
  totals: {
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
    deliveryCharges: number;
    discount: number;
    grandTotal: number;
  };
}

function money(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A printable tax invoice.
 *
 * Rendered as a page the browser prints rather than a PDF built on the server:
 * it needs no dependency, stays selectable and searchable, and "Save as PDF"
 * is in every print dialogue anyway.
 */
export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.orderId ?? '');
  const { user, isSessionReady, authFetch } = useApp();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isSessionReady) return;
    if (!user) {
      setStatus('error');
      setMessage('Sign in to see this invoice.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await authFetch(`/orders/${orderId}/invoice`);
        if (cancelled) return;

        if (res?.ok) {
          setInvoice(await res.json());
          setStatus('ready');
          return;
        }

        const body = await res?.json().catch(() => null);
        setMessage(body?.message || 'That invoice is not available.');
        setStatus('error');
      } catch {
        if (!cancelled) {
          setMessage('Could not reach the server.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, isSessionReady, user]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F3]">
        <div className="animate-pulse text-sm text-[#6b6661]">Preparing your invoice…</div>
      </div>
    );
  }

  if (status === 'error' || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F3] px-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-md text-center">
          <h1 className="font-serif font-black text-xl text-[#2A2A2A] mb-2">No invoice yet</h1>
          <p className="text-sm text-[#6b6661] mb-5">{message}</p>
          <Link
            href="/account?tab=orders"
            className="inline-block px-5 py-2.5 bg-[#3A6038] hover:bg-[#2d4d2b] text-white text-xs font-bold rounded-xl transition"
          >
            Back to my orders
          </Link>
        </div>
      </div>
    );
  }

  const { seller, buyer, totals, lines } = invoice;
  const isIntraState = invoice.taxKind === 'CGST_SGST';

  return (
    <div className="min-h-screen bg-[#FAF8F3] py-8 px-4 print:bg-white print:py-0">
      {/* Chrome, dropped from the printed sheet */}
      <div className="max-w-3xl mx-auto mb-5 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.push('/account?tab=orders')}
          className="flex items-center gap-2 text-xs font-bold text-[#6b6661] hover:text-[#2A2A2A] transition"
        >
          <ArrowLeft className="h-4 w-4" /> My orders
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3A6038] hover:bg-[#2d4d2b] text-white text-xs font-bold rounded-xl transition"
        >
          <Printer className="h-4 w-4" /> Print or save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white border border-stone-200 print:border-0 p-8 sm:p-10 text-[#2A2A2A]">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b-2 border-[#2A2A2A]">
          <div>
            <h1 className="font-serif font-black text-2xl">{seller.tradeName}</h1>
            {seller.legalName !== seller.tradeName && (
              <p className="text-xs text-[#6b6661]">{seller.legalName}</p>
            )}
            <p className="text-xs text-[#6b6661] mt-2 leading-relaxed">
              {[seller.addressLine1, seller.addressLine2].filter(Boolean).join(', ')}
              <br />
              {[seller.city, seller.state, seller.postalCode].filter(Boolean).join(', ')}
              <br />
              {seller.phone} · {seller.email}
            </p>
            {seller.gstin && (
              <p className="text-xs font-bold mt-2">GSTIN: {seller.gstin}</p>
            )}
            {seller.fssaiLicence && (
              <p className="text-xs text-[#6b6661]">FSSAI: {seller.fssaiLicence}</p>
            )}
          </div>

          <div className="text-right">
            {/* Without a GSTIN this is legally a bill of supply, not a tax
                invoice, and calling it the wrong thing is its own problem. */}
            <h2 className="font-serif font-bold text-lg uppercase tracking-wide">
              {invoice.isTaxInvoice ? 'Tax Invoice' : 'Bill of Supply'}
            </h2>
            <p className="text-xs font-mono mt-1">{invoice.invoiceNumber}</p>
            <p className="text-xs text-[#6b6661] mt-2">
              Invoice date: {formatDate(invoice.invoiceDate)}
              <br />
              Order {invoice.orderNumber} · {formatDate(invoice.orderDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 border-b border-stone-200">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b6661] mb-1.5">
              Billed to
            </p>
            <p className="text-sm font-bold">{buyer.name}</p>
            <p className="text-xs text-[#6b6661] leading-relaxed mt-0.5">
              {[buyer.addressLine1, buyer.addressLine2].filter(Boolean).join(', ')}
              <br />
              {[buyer.city, buyer.state, buyer.postalCode].filter(Boolean).join(', ')}
              {buyer.phone && (
                <>
                  <br />
                  {buyer.phone}
                </>
              )}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b6661] mb-1.5">
              Place of supply
            </p>
            <p className="text-sm font-bold">{invoice.placeOfSupply}</p>
            <p className="text-xs text-[#6b6661] mt-0.5">
              {isIntraState ? 'Within state — CGST + SGST' : 'Inter-state — IGST'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto py-5">
          <table className="w-full text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[#6b6661] border-b border-stone-300">
                <th className="text-left pb-2">Description</th>
                <th className="text-left pb-2 px-2">HSN</th>
                <th className="text-right pb-2 px-2">Qty</th>
                <th className="text-right pb-2 px-2">Taxable</th>
                <th className="text-right pb-2 px-2">GST</th>
                {isIntraState ? (
                  <>
                    <th className="text-right pb-2 px-2">CGST</th>
                    <th className="text-right pb-2 px-2">SGST</th>
                  </>
                ) : (
                  <th className="text-right pb-2 px-2">IGST</th>
                )}
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-2.5">
                    <span className="font-bold">{line.description}</span>
                    {line.variant && (
                      <span className="block text-[#6b6661]">{line.variant}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[#6b6661]">{line.hsnCode || '—'}</td>
                  <td className="py-2.5 px-2 text-right">{line.quantity}</td>
                  <td className="py-2.5 px-2 text-right">{money(line.taxableValue)}</td>
                  <td className="py-2.5 px-2 text-right text-[#6b6661]">{line.gstRate}%</td>
                  {isIntraState ? (
                    <>
                      <td className="py-2.5 px-2 text-right">{money(line.cgst)}</td>
                      <td className="py-2.5 px-2 text-right">{money(line.sgst)}</td>
                    </>
                  ) : (
                    <td className="py-2.5 px-2 text-right">{money(line.igst)}</td>
                  )}
                  <td className="py-2.5 text-right font-bold">{money(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-stone-200 pt-4">
          <dl
            className="w-full sm:w-72 text-xs space-y-1.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <div className="flex justify-between">
              <dt className="text-[#6b6661]">Taxable value</dt>
              <dd>{money(totals.taxableValue)}</dd>
            </div>
            {isIntraState ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-[#6b6661]">CGST</dt>
                  <dd>{money(totals.cgst)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b6661]">SGST</dt>
                  <dd>{money(totals.sgst)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-[#6b6661]">IGST</dt>
                <dd>{money(totals.igst)}</dd>
              </div>
            )}
            {totals.deliveryCharges > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#6b6661]">Delivery</dt>
                <dd>{money(totals.deliveryCharges)}</dd>
              </div>
            )}
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#6b6661]">Discount</dt>
                <dd>−{money(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-300 pt-2 mt-2 text-sm font-black">
              <dt>Total</dt>
              <dd>{money(totals.grandTotal)}</dd>
            </div>
          </dl>
        </div>

        <p className="text-[10px] text-[#6b6661] leading-relaxed border-t border-stone-200 mt-6 pt-4">
          Prices are inclusive of GST. This is a computer-generated document and needs no
          signature.
          {!invoice.isTaxInvoice && ' Issued as a bill of supply — GST is not charged separately.'}
        </p>
      </div>
    </div>
  );
}
