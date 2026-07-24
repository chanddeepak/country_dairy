import React, { useState } from 'react';
import { ShieldCheck, Plus, FileText, QrCode, Trash2 } from 'lucide-react';
import type { LabCertificate } from '../types';

export default function PurityLabCMS() {
  const [certs, setCerts] = useState<LabCertificate[]>([
    {
      id: 'cert-1',
      batchCode: 'BATCH-2026-GHEE03',
      pdfUrl: 'https://example.com/certs/ghee-batch-03.pdf',
      testDate: '2026-07-01',
      purityPercentage: 99.8,
      notes: '100% Certified Pure Bilona Ghee. Free from adulteration, heavy metals, and preservatives.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'cert-2',
      batchCode: 'BATCH-2026-MILK01',
      pdfUrl: 'https://example.com/certs/milk-batch-01.pdf',
      testDate: '2026-07-04',
      purityPercentage: 100,
      notes: 'Fresh A2 Cow Milk. Zero antibiotics, zero synthetic hormones (rBST-free).',
      createdAt: new Date().toISOString(),
    },
  ]);

  const [selectedCert, setSelectedCert] = useState<LabCertificate | null>(certs[0]);

  // Form State for new cert
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [batchCodeInput, setBatchCodeInput] = useState('');
  const [purityInput, setPurityInput] = useState('99.8');
  const [testDateInput, setTestDateInput] = useState('2026-07-15');
  const [notesInput, setNotesInput] = useState('');

  const handleAddCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCodeInput.trim()) return;

    const newCert: LabCertificate = {
      id: `cert-${Date.now()}`,
      batchCode: batchCodeInput.trim().toUpperCase(),
      pdfUrl: 'https://example.com/certs/uploaded-lab-report.pdf',
      testDate: testDateInput,
      purityPercentage: parseFloat(purityInput) || 99.8,
      notes: notesInput.trim(),
      createdAt: new Date().toISOString(),
    };

    setCerts(prev => [newCert, ...prev]);
    setSelectedCert(newCert);
    setIsModalOpen(false);
    setBatchCodeInput('');
    setNotesInput('');
    alert(`Batch Purity Certificate issued for ${newCert.batchCode}!`);
  };

  const handleDeleteCert = (id: string) => {
    if (confirm('Delete this batch certificate?')) {
      setCerts(prev => prev.filter(c => c.id !== id));
      if (selectedCert?.id === id) setSelectedCert(null);
    }
  };

  return (
    <div className="space-y-6 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900 p-6 rounded-2xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold">Batch Purity & Lab Certificate Manager</h1>
          </div>
          <p className="text-xs text-stone-400">
            Upload PDF lab reports per batch code. System auto-generates QR codes for product jar labels.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <Plus className="h-4 w-4" /> Issue Batch Certificate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">Certified Batches</h2>
          {certs.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCert(c)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedCert?.id === c.id
                  ? 'bg-stone-800 border-amber-500 shadow-lg'
                  : 'bg-stone-900 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-amber-400">{c.batchCode}</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                  {c.purityPercentage}% Purity Score
                </span>
              </div>
              <div className="text-xs text-stone-300 font-medium truncate">{c.notes}</div>
              <div className="text-[10px] text-stone-500 font-mono mt-2">Tested: {c.testDate}</div>
            </div>
          ))}
        </div>

        {/* Right QR & Report Details */}
        <div className="lg:col-span-7">
          {selectedCert ? (
            <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-6">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-stone-100">{selectedCert.batchCode}</h2>
                  <p className="text-xs text-stone-400">Purity Verification Details</p>
                </div>
                <button
                  onClick={() => handleDeleteCert(selectedCert.id)}
                  className="p-1.5 text-stone-400 hover:text-red-400 transition-colors"
                  title="Delete Certificate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* QR Code Jar Preview Simulator */}
              <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 flex items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="h-4 w-4" /> Jar Scan QR Code
                  </div>
                  <p className="text-xs text-stone-300">
                    Print this QR code on the jar label. Scanning redirects customers to the public purity report page.
                  </p>
                  <div className="text-[11px] font-mono text-stone-500 break-all">
                    URL: https://countrydairy.in/purity/{selectedCert.batchCode}
                  </div>
                </div>

                {/* Simulated QR Code SVG Graphic */}
                <div className="w-28 h-28 bg-white p-2 rounded-xl shrink-0 flex items-center justify-center border-2 border-amber-400 shadow-xl">
                  <svg viewBox="0 0 21 21" className="w-full h-full text-stone-950 fill-current">
                    {/* Position detection pattern - Top Left */}
                    <rect x="0" y="0" width="7" height="7" fill="black" />
                    <rect x="1" y="1" width="5" height="5" fill="white" />
                    <rect x="2" y="2" width="3" height="3" fill="black" />
                    {/* Position detection pattern - Top Right */}
                    <rect x="14" y="0" width="7" height="7" fill="black" />
                    <rect x="15" y="1" width="5" height="5" fill="white" />
                    <rect x="16" y="2" width="3" height="3" fill="black" />
                    {/* Position detection pattern - Bottom Left */}
                    <rect x="0" y="14" width="7" height="7" fill="black" />
                    <rect x="1" y="15" width="5" height="5" fill="white" />
                    <rect x="2" y="16" width="3" height="3" fill="black" />
                    {/* Alignment & Data pixels */}
                    <rect x="8" y="2" width="2" height="2" fill="black" />
                    <rect x="11" y="4" width="2" height="2" fill="black" />
                    <rect x="9" y="8" width="3" height="3" fill="black" />
                    <rect x="2" y="9" width="2" height="2" fill="black" />
                    <rect x="14" y="9" width="4" height="2" fill="black" />
                    <rect x="10" y="13" width="2" height="3" fill="black" />
                    <rect x="15" y="14" width="3" height="3" fill="black" />
                    <rect x="13" y="18" width="3" height="2" fill="black" />
                  </svg>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-1">
                  <div className="text-stone-400 font-semibold">Laboratory Verification Notes</div>
                  <div className="text-stone-200 leading-relaxed font-medium">{selectedCert.notes}</div>
                </div>

                <div className="flex items-center justify-between p-3 bg-stone-950 rounded-xl border border-stone-800">
                  <div className="flex items-center gap-2 text-stone-300 font-semibold">
                    <FileText className="h-4 w-4 text-amber-400" />
                    <span>Official NABL Certified PDF Report</span>
                  </div>
                  <a
                    href={selectedCert.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg text-xs transition-colors"
                  >
                    View PDF
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-[300px] flex items-center justify-center bg-stone-900 rounded-2xl border border-stone-800 text-stone-500 text-xs">
              Select a batch certificate to view details & QR code.
            </div>
          )}
        </div>
      </div>

      {/* Issue Cert Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-stone-800 border border-stone-700 w-full max-w-md rounded-2xl p-6 shadow-2xl text-stone-100 space-y-4">
            <h3 className="text-lg font-bold">Issue Batch Purity Certificate</h3>
            <form onSubmit={handleAddCert} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Batch Code *</label>
                <input
                  type="text"
                  required
                  value={batchCodeInput}
                  onChange={(e) => setBatchCodeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono"
                  placeholder="e.g. BATCH-2026-GHEE04"
                />
              </div>

              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Purity Score (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={purityInput}
                  onChange={(e) => setPurityInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-amber-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Testing Date</label>
                <input
                  type="date"
                  value={testDateInput}
                  onChange={(e) => setTestDateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100"
                />
              </div>

              <div>
                <label className="block text-stone-300 mb-1 font-semibold">QA Report Notes</label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100"
                  placeholder="e.g. Tested for A2 beta-casein protein purity..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-700 rounded-lg text-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-stone-950 rounded-lg font-bold"
                >
                  Issue Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
