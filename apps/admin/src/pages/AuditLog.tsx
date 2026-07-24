import React, { useState } from 'react';
import { History, Search, Filter, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import type { AuditLog } from '../types';

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-101',
    actorId: 'usr-002',
    actorName: 'Ananya Sharma',
    actorEmail: 'catalog@countrydairy.in',
    action: 'PRICE_UPDATE',
    entityType: 'Product Variant',
    entityId: 'var-1',
    oldData: { sku: 'CD-GHEE-1L', sellingPrice: 1550, mrpPrice: 1800 },
    newData: { sku: 'CD-GHEE-1L', sellingPrice: 1499, mrpPrice: 1800 },
    ipAddress: '103.24.12.89',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 mins ago
  },
  {
    id: 'log-102',
    actorId: 'usr-003',
    actorName: 'Rajesh Kumar',
    actorEmail: 'orders@countrydairy.in',
    action: 'STOCK_ADJUSTMENT',
    entityType: 'Inventory Stock',
    entityId: 'var-3',
    oldData: { sku: 'CD-GHEE-2.5L-DOLCHI', stockQuantity: 5 },
    newData: { sku: 'CD-GHEE-2.5L-DOLCHI', stockQuantity: 0, status: 'OUT_OF_STOCK' },
    ipAddress: '49.36.20.12',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: 'log-103',
    actorId: 'usr-001',
    actorName: 'Deepak Chand',
    actorEmail: 'admin@countrydairy.in',
    action: 'FEATURE_FLAG_TOGGLE',
    entityType: 'Feature Flag',
    entityId: 'ENABLE_WEBSITE_PAYMENT',
    oldData: { key: 'ENABLE_WEBSITE_PAYMENT', isEnabled: true },
    newData: { key: 'ENABLE_WEBSITE_PAYMENT', isEnabled: false },
    ipAddress: '182.72.10.45',
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 hours ago
  },
  {
    id: 'log-104',
    actorId: 'usr-001',
    actorName: 'Deepak Chand',
    actorEmail: 'admin@countrydairy.in',
    action: 'HERO_SLIDE_ADDED',
    entityType: 'Hero Carousel',
    entityId: 'slide-3',
    oldData: null,
    newData: { title: 'Pure A2 Gir Cow Bilona Ghee', ctaLink: '/products/ghee', sortOrder: 3 },
    ipAddress: '182.72.10.45',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
  },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = selectedActionFilter === 'ALL' || log.action === selectedActionFilter;
    return matchesSearch && matchesAction;
  });

  const handleRevertChange = (log: AuditLog) => {
    if (!log.oldData) {
      alert('Cannot revert creation events.');
      return;
    }
    if (confirm(`Revert action "${log.action}" by ${log.actorName}? This will restore previous values.`)) {
      alert(`Successfully reverted ${log.entityType} (${log.entityId}) to previous state.`);
      // Add a new rollback log entry
      const rollbackEntry: AuditLog = {
        id: `log-${Date.now()}`,
        actorId: 'usr-001',
        actorName: 'Deepak Chand (Super Admin)',
        actorEmail: 'admin@countrydairy.in',
        action: 'REVERT_ACTION',
        entityType: log.entityType,
        entityId: log.entityId,
        oldData: log.newData,
        newData: log.oldData,
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
      };
      setLogs(prev => [rollbackEntry, ...prev]);
    }
  };

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="h-6 w-6 text-[#064e3b]" />
            <h1 className="text-xl font-serif font-bold text-[#2A2A2A]">Audit Logs & Change History</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            Immutable log of all price updates, stock changes, hero slides, and feature flag mutations with one-click rollback.
          </p>
        </div>

        <div className="text-xs font-mono text-[#064e3b] bg-[#064e3b]/10 px-3 py-1.5 rounded-xl border border-[#064e3b]/20 font-bold">
          Total Recorded Actions: <span className="text-[#C59B27] font-black">{logs.length}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6661]" />
          <input
            type="text"
            placeholder="Search by staff name, email, entity or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs text-[#2A2A2A] font-medium focus:outline-none focus:border-[#064e3b]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#6b6661]" />
          <select
            value={selectedActionFilter}
            onChange={(e) => setSelectedActionFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs font-bold text-[#2A2A2A]"
          >
            <option value="ALL">All Actions</option>
            <option value="PRICE_UPDATE">Price Update</option>
            <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
            <option value="FEATURE_FLAG_TOGGLE">Feature Flag Toggle</option>
            <option value="HERO_SLIDE_ADDED">Hero Slide Added</option>
            <option value="REVERT_ACTION">Revert Action</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-[#2A2A2A]">
          <thead className="bg-[#FAF8F3] text-[#6b6661] font-bold border-b border-stone-200 uppercase tracking-wider">
            <tr>
              <th className="w-10 px-4 py-3.5"></th>
              <th className="px-4 py-3.5">Timestamp</th>
              <th className="px-4 py-3.5">Staff Member</th>
              <th className="px-4 py-3.5">Action Type</th>
              <th className="px-4 py-3.5">Entity</th>
              <th className="px-4 py-3.5 text-right">Super Admin Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-medium">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <React.Fragment key={log.id}>
                  <tr 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="hover:bg-[#FAF8F3]/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-stone-400">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-[#064e3b]" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#6b6661]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[#2A2A2A]">{log.actorName}</div>
                      <div className="text-[10px] text-[#6b6661] font-mono">{log.actorEmail}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded font-mono text-[10px] font-black uppercase ${
                        log.action === 'PRICE_UPDATE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        log.action === 'STOCK_ADJUSTMENT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        log.action === 'REVERT_ACTION' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#2A2A2A]">
                      {log.entityType} <code className="text-[10px] text-[#6b6661]">({log.entityId})</code>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {log.oldData && (
                        <button
                          onClick={() => handleRevertChange(log)}
                          className="px-3 py-1 bg-[#FAF8F3] hover:bg-stone-100 text-[#064e3b] border border-stone-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                          title="Revert change to previous state"
                        >
                          <RotateCcw className="h-3 w-3" /> Revert
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded JSON Diff Row */}
                  {isExpanded && (
                    <tr className="bg-[#FAF8F3]/80">
                      <td colSpan={6} className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                          {/* Old Data */}
                          <div className="bg-white p-3.5 rounded-xl border border-red-200 shadow-sm">
                            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2">
                              - Previous State (Old Data)
                            </div>
                            <pre className="text-[11px] text-red-900 overflow-x-auto">
                              {log.oldData ? JSON.stringify(log.oldData, null, 2) : 'null (Created new record)'}
                            </pre>
                          </div>

                          {/* New Data */}
                          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm">
                            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
                              + Updated State (New Data)
                            </div>
                            <pre className="text-[11px] text-emerald-900 overflow-x-auto">
                              {JSON.stringify(log.newData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
