import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { adminApi } from '../services/apiClient';
import { resolveImageUrl } from '../components/common/ImageUploader';
import type { LabParameter, LabReport, Product } from '../types';

const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://countrydairy.in';
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const field =
  'w-full px-3 py-2 bg-[#FAF8F3] border border-stone-200 rounded-lg text-sm text-[#2A2A2A] focus:outline-none focus:border-[#064e3b] transition-colors';
const label = 'block text-[11px] font-bold text-[#6b6661] uppercase tracking-wider mb-1.5';

/** Suggested rows per product line, so staff are not typing these from memory. */
const PARAMETER_PRESETS: Record<string, LabParameter[]> = {
  ghee: [
    { name: 'Milk Fat', value: '', standard: 'min 99.5%' },
    { name: 'Moisture', value: '', standard: 'max 0.5%' },
    { name: 'Free Fatty Acid (as oleic)', value: '', standard: 'max 3.0%' },
    { name: 'Baudouin Test (vanaspati)', value: '', standard: 'Negative' },
    { name: 'Reichert Meissl Value', value: '', standard: 'min 28' },
  ],
  milk: [
    { name: 'Milk Fat', value: '', standard: 'min 3.5%' },
    { name: 'SNF', value: '', standard: 'min 8.5%' },
    { name: 'Added Water', value: '', standard: 'Nil' },
    { name: 'Urea', value: '', standard: 'Absent' },
    { name: 'Detergent', value: '', standard: 'Absent' },
    { name: 'Antibiotic Residue', value: '', standard: 'Absent' },
  ],
  honey: [
    { name: 'Moisture', value: '', standard: 'max 20%' },
    { name: 'Fructose / Glucose Ratio', value: '', standard: 'min 1.0' },
    { name: 'HMF', value: '', standard: 'max 80 mg/kg' },
    { name: 'C4 Sugar (SIRA)', value: '', standard: 'max 7%' },
  ],
  oil: [
    { name: 'Argemone Oil', value: '', standard: 'Absent' },
    { name: 'Free Fatty Acid', value: '', standard: 'max 1.25%' },
    { name: 'Peroxide Value', value: '', standard: 'max 10 meq/kg' },
  ],
};

function presetFor(productTitle: string): LabParameter[] {
  const t = productTitle.toLowerCase();
  const key = Object.keys(PARAMETER_PRESETS).find((k) => t.includes(k));
  return key ? PARAMETER_PRESETS[key].map((p) => ({ ...p })) : [];
}

function resultPlaceholder(standard?: string): string {
  if (!standard) return '99.7%';
  // "Absent" / "Nil" / "Negative" describe the answer's shape; "min 3.5%" only
  // describes the limit, so suggesting "99.7%" against an Absent row reads as
  // if a number were expected there.
  return /^(absent|nil|negative|not detected)$/i.test(standard.trim()) ? standard : '99.7%';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface FormState {
  id: string | null;
  productId: string;
  batchNumber: string;
  testDate: string;
  labName: string;
  fileUrl: string;
  notes: string;
  parameters: LabParameter[];
  isPublished: boolean;
}

function emptyForm(productId: string): FormState {
  return {
    id: null,
    productId,
    batchNumber: '',
    // Today, because a report is nearly always entered the day it arrives.
    testDate: new Date().toISOString().slice(0, 10),
    labName: '',
    fileUrl: '',
    notes: '',
    parameters: [],
    isPublished: true,
  };
}

function formFrom(report: LabReport): FormState {
  return {
    id: report.id,
    productId: report.productId,
    batchNumber: report.batchNumber,
    testDate: report.testDate.slice(0, 10),
    labName: report.labName ?? '',
    fileUrl: report.fileUrl ?? '',
    notes: report.notes ?? '',
    parameters: report.parameters.map((p) => ({ ...p })),
    isPublished: report.isPublished,
  };
}

interface PurityLabCMSProps {
  products: Product[];
}

/**
 * Batch lab reports, the evidence behind the purity claims the storefront
 * makes. Was a demo page holding two hardcoded certificates in useState; it
 * now reads and writes the LabReport table.
 */
export default function PurityLabCMS({ products }: PurityLabCMSProps) {
  const [reports, setReports] = useState<LabReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<LabReport | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getLabReports(productFilter || undefined);
      setReports(data);
      setSelectedId((current) =>
        current && data.some((r) => r.id === current) ? current : (data[0]?.id ?? null),
      );
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lab reports.');
    } finally {
      setIsLoading(false);
    }
  }, [productFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const openNew = () => {
    setFormError('');
    setForm(emptyForm(productFilter || products[0]?.id || ''));
  };

  const openEdit = (report: LabReport) => {
    setFormError('');
    setForm(formFrom(report));
  };

  const patchForm = (patch: Partial<FormState>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const updateParameter = (index: number, patch: Partial<LabParameter>) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            parameters: prev.parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)),
          }
        : prev,
    );

  const handlePdf = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setFormError('The lab report must be a PDF.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setFormError('That PDF is over the 20MB limit.');
      return;
    }

    setFormError('');
    setIsUploading(true);
    try {
      const url = await adminApi.uploadMedia(file, file.name, 'lab-reports', 'application/pdf');
      patchForm({ fileUrl: url });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not upload that PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  const save = async () => {
    if (!form) return;

    if (!form.productId) {
      setFormError('Choose the product this batch belongs to.');
      return;
    }
    if (form.batchNumber.trim().length < 3) {
      setFormError('Enter the batch number printed on the jar.');
      return;
    }
    if (!form.testDate) {
      setFormError('Enter the date the batch was tested.');
      return;
    }

    // Blank rows are dropped rather than saved as an empty parameter.
    const parameters = form.parameters.filter((p) => p.name.trim() && p.value.trim());

    setFormError('');
    setIsSaving(true);
    try {
      const payload = {
        batchNumber: form.batchNumber.trim().toUpperCase(),
        testDate: new Date(form.testDate).toISOString(),
        labName: form.labName.trim() || undefined,
        fileUrl: form.fileUrl || undefined,
        notes: form.notes.trim() || undefined,
        parameters,
        isPublished: form.isPublished,
      };

      const saved = form.id
        ? await adminApi.updateLabReport(form.id, payload)
        : await adminApi.createLabReport({ ...payload, productId: form.productId });

      setReports((prev) => {
        const without = prev.filter((r) => r.id !== saved.id);
        return [saved, ...without].sort(
          (a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime(),
        );
      });
      setSelectedId(saved.id);
      setForm(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this report.');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublished = async (report: LabReport) => {
    setBusyId(report.id);
    try {
      const saved = await adminApi.updateLabReport(report.id, {
        isPublished: !report.isPublished,
      });
      setReports((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change visibility.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setBusyId(pendingDelete.id);
    try {
      await adminApi.deleteLabReport(pendingDelete.id);
      setReports((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      if (selectedId === pendingDelete.id) setSelectedId(null);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this report.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-[#C59B27]" />
            <h1 className="text-xl font-serif font-bold">Batch Lab Reports</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            The evidence behind the purity claims on the storefront. Published reports appear on
            the product page and resolve the QR code printed on the jar.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className={`${field} w-auto min-w-[180px]`}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openNew}
            disabled={products.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add Report
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#6b6661] bg-white rounded-2xl border border-stone-200/80">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lab reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200/80 shadow-sm text-center">
          <FlaskConical className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <h2 className="text-sm font-bold mb-1">No lab reports yet</h2>
          <p className="text-xs text-[#6b6661] max-w-md mx-auto">
            Add the report for a tested batch and it appears on that product&apos;s page as proof
            of purity. Until then the storefront makes no test claims.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Batch list */}
          <div className="lg:col-span-5 space-y-2.5">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] px-1">
              Tested Batches ({reports.length})
            </h2>

            {reports.map((r) => {
              const isActive = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                    isActive
                      ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-sm'
                      : 'bg-white border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`font-mono text-xs font-bold ${isActive ? 'text-[#fde68a]' : 'text-[#064e3b]'}`}
                    >
                      {r.batchNumber}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                        r.isPublished
                          ? isActive
                            ? 'bg-white/15 text-white border-white/20'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isActive
                            ? 'bg-white/15 text-white border-white/20'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                      }`}
                    >
                      {r.isPublished ? 'Live' : 'Held back'}
                    </span>
                  </div>

                  <div
                    className={`text-xs font-medium truncate ${isActive ? 'text-white/90' : 'text-[#2A2A2A]'}`}
                  >
                    {r.productTitle}
                  </div>
                  <div
                    className={`text-[10px] mt-1.5 ${isActive ? 'text-white/60' : 'text-[#6b6661]'}`}
                  >
                    Tested {formatDate(r.testDate)}
                    {r.labName ? ` · ${r.labName}` : ''}
                    {r.parameters.length > 0 ? ` · ${r.parameters.length} parameters` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-7">
            {selected ? (
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
                <div className="flex items-start justify-between gap-3 p-6">
                  <div>
                    <h2 className="text-base font-serif font-bold">{selected.batchNumber}</h2>
                    <p className="text-xs text-[#6b6661] mt-0.5">
                      {selected.productTitle} · tested {formatDate(selected.testDate)}
                      {selected.labName ? ` at ${selected.labName}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePublished(selected)}
                      disabled={busyId === selected.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors disabled:opacity-50"
                      title={
                        selected.isPublished
                          ? 'Hide this report from the storefront'
                          : 'Publish this report to the storefront'
                      }
                    >
                      {busyId === selected.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : selected.isPublished ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {selected.isPublished ? 'Hide' : 'Publish'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEdit(selected)}
                      className="p-2 text-stone-400 hover:text-[#064e3b] hover:bg-stone-50 rounded-lg transition-colors"
                      title="Edit report"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingDelete(selected)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Parameters */}
                <div className="p-6">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] mb-3">
                    Tested Parameters
                  </h3>

                  {selected.parameters.length === 0 ? (
                    <p className="text-xs text-[#6b6661]">
                      No parameters recorded. The storefront shows the batch and the PDF only.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] font-bold text-[#6b6661] uppercase tracking-wider border-b border-stone-200">
                            <th className="pb-2 pr-3">Parameter</th>
                            <th className="pb-2 pr-3">Result</th>
                            <th className="pb-2 pr-3">Permissible</th>
                            <th className="pb-2">Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {selected.parameters.map((p, i) => (
                            <tr key={i}>
                              <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                              <td className="py-2.5 pr-3 font-mono font-bold text-[#064e3b]">
                                {p.value}
                              </td>
                              <td className="py-2.5 pr-3 text-[#6b6661]">{p.standard || '—'}</td>
                              <td className="py-2.5">
                                {p.passed === undefined ? (
                                  <span className="text-[#6b6661]">—</span>
                                ) : p.passed ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                    <Check className="h-3.5 w-3.5" /> Pass
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                                    <X className="h-3.5 w-3.5" /> Fail
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {selected.notes && (
                  <div className="p-6">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6b6661] mb-2">
                      Notes
                    </h3>
                    <p className="text-xs leading-relaxed text-[#2A2A2A]">{selected.notes}</p>
                  </div>
                )}

                {/* PDF */}
                <div className="p-6 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6b6661]">
                    <FileText className="h-4 w-4 text-[#C59B27]" />
                    {selected.fileUrl ? 'Signed lab report (PDF)' : 'No PDF attached yet'}
                  </div>

                  {selected.fileUrl && (
                    <a
                      href={resolveImageUrl(selected.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold rounded-lg text-[11px] transition-colors"
                    >
                      Open PDF
                    </a>
                  )}
                </div>

                {/* QR target */}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#6b6661] mb-2">
                    <QrCode className="h-4 w-4" /> Jar QR Destination
                  </div>
                  <p className="text-xs text-[#6b6661] mb-2">
                    Point the QR code printed on the label at this URL. It resolves to this batch
                    only while the report is published.
                  </p>
                  <code className="block text-[11px] font-mono text-[#064e3b] bg-[#FAF8F3] border border-stone-200 rounded-lg px-3 py-2 break-all">
                    {PUBLIC_SITE_URL}/purity/{selected.batchNumber}
                  </code>
                </div>
              </div>
            ) : (
              <div className="min-h-[260px] flex items-center justify-center bg-white rounded-2xl border border-stone-200/80 text-xs text-[#6b6661]">
                Select a batch to see its results.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / edit modal */}
      {form && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h3 className="text-base font-serif font-bold">
                {form.id ? 'Edit Lab Report' : 'Add Lab Report'}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="p-1.5 text-stone-400 hover:text-[#2A2A2A] rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Product *</label>
                  <select
                    value={form.productId}
                    // The batch belongs to a product; moving it would silently
                    // reassign published evidence, so it is fixed after create.
                    disabled={!!form.id}
                    onChange={(e) => patchForm({ productId: e.target.value })}
                    className={`${field} disabled:opacity-60`}
                  >
                    <option value="">Choose a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={label}>Batch Number *</label>
                  <input
                    type="text"
                    value={form.batchNumber}
                    onChange={(e) => patchForm({ batchNumber: e.target.value.toUpperCase() })}
                    placeholder="CD-2026-07"
                    className={`${field} font-mono`}
                  />
                </div>

                <div>
                  <label className={label}>Test Date *</label>
                  <input
                    type="date"
                    value={form.testDate}
                    onChange={(e) => patchForm({ testDate: e.target.value })}
                    className={field}
                  />
                </div>

                <div>
                  <label className={label}>Testing Laboratory</label>
                  <input
                    type="text"
                    value={form.labName}
                    onChange={(e) => patchForm({ labName: e.target.value })}
                    placeholder="NABL-accredited lab name"
                    className={field}
                  />
                </div>
              </div>

              {/* Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`${label} mb-0`}>Tested Parameters</label>

                  <div className="flex items-center gap-2">
                    {form.parameters.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const product = products.find((p) => p.id === form.productId);
                          const preset = product ? presetFor(product.title) : [];
                          patchForm({
                            parameters: preset.length
                              ? preset
                              : [{ name: '', value: '', standard: '' }],
                          });
                        }}
                        className="text-[11px] font-bold text-[#064e3b] hover:underline"
                      >
                        Use standard rows
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        patchForm({
                          parameters: [...form.parameters, { name: '', value: '', standard: '' }],
                        })
                      }
                      className="flex items-center gap-1 text-[11px] font-bold text-[#064e3b] hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add row
                    </button>
                  </div>
                </div>

                {form.parameters.length === 0 ? (
                  <p className="text-xs text-[#6b6661] py-4 text-center border border-dashed border-stone-300 rounded-xl">
                    Optional. Without rows the storefront shows the batch and PDF only.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-[10px] font-bold text-[#6b6661] uppercase tracking-wider">
                      <span>Parameter</span>
                      <span>Result</span>
                      <span>Permissible</span>
                      <span className="w-14 text-center">Pass</span>
                      <span className="w-8" />
                    </div>

                    {form.parameters.map((p, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center"
                      >
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updateParameter(i, { name: e.target.value })}
                          placeholder="Milk Fat"
                          className={field}
                        />
                        <input
                          type="text"
                          value={p.value}
                          onChange={(e) => updateParameter(i, { value: e.target.value })}
                          placeholder={resultPlaceholder(p.standard)}
                          className={field}
                        />
                        <input
                          type="text"
                          value={p.standard ?? ''}
                          onChange={(e) => updateParameter(i, { standard: e.target.value })}
                          placeholder="min 99.5%"
                          className={field}
                        />
                        <label className="w-14 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={p.passed === true}
                            onChange={(e) =>
                              updateParameter(i, {
                                passed: e.target.checked ? true : undefined,
                              })
                            }
                            className="h-4 w-4 accent-[#064e3b]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            patchForm({ parameters: form.parameters.filter((_, x) => x !== i) })
                          }
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={label}>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => patchForm({ notes: e.target.value })}
                  placeholder="What the customer should understand from these results."
                  className={field}
                />
              </div>

              {/* PDF */}
              <div>
                <label className={label}>Signed Report (PDF)</label>

                {form.fileUrl ? (
                  <div className="flex items-center justify-between gap-3 p-3 bg-[#FAF8F3] border border-stone-200 rounded-xl">
                    <a
                      href={resolveImageUrl(form.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs font-semibold text-[#064e3b] hover:underline truncate"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{form.fileUrl.split('/').pop()}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => patchForm({ fileUrl: '' })}
                      className="p-1.5 text-stone-400 hover:text-red-600 rounded transition-colors shrink-0"
                      title="Remove PDF"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex items-center justify-center gap-2 py-6 border border-dashed rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      isUploading
                        ? 'border-stone-200 text-[#6b6661]'
                        : 'border-stone-300 text-[#064e3b] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Upload the lab&apos;s PDF (max 20MB)
                      </>
                    )}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePdf(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-[#FAF8F3] border border-stone-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => patchForm({ isPublished: e.target.checked })}
                  className="h-4 w-4 mt-0.5 accent-[#064e3b]"
                />
                <span className="text-xs">
                  <span className="font-bold block">Show on the storefront</span>
                  <span className="text-[#6b6661]">
                    Uncheck to keep the results in the console while a batch is still under review.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 p-6 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving || isUploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> {form.id ? 'Save Report' : 'Add Report'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h3 className="text-base font-serif font-bold">Delete this report?</h3>
            </div>

            <p className="text-xs text-[#6b6661] leading-relaxed">
              Batch <span className="font-mono font-bold">{pendingDelete.batchNumber}</span> and its
              PDF are removed for good. Any QR code already printed on those jars will stop
              resolving.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-stone-200 text-[#6b6661] hover:bg-stone-50 transition-colors"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busyId === pendingDelete.id}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {busyId === pendingDelete.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
