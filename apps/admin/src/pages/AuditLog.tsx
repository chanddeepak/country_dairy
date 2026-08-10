import React, { useCallback, useEffect, useState } from 'react';
import { History, Search, Filter, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { adminApi } from '../services/apiClient';
import type { AuditEntry } from '../types';

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  ARCHIVE: 'bg-stone-100 text-stone-700 border-stone-300',
  STATUS_CHANGE: 'bg-purple-50 text-purple-700 border-purple-200',
  TOGGLE: 'bg-amber-50 text-amber-700 border-amber-200',
  PASSWORD_RESET: 'bg-rose-50 text-rose-700 border-rose-200',
};

function actionStyle(action: string): string {
  return ACTION_STYLES[action] ?? 'bg-stone-50 text-stone-700 border-stone-200';
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [filters, setFilters] = useState<{ entities: string[]; actions: string[] }>({
    entities: [],
    actions: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setLogs(
        await adminApi.getAuditLog({
          entity: entityFilter === 'ALL' ? undefined : entityFilter,
          action: actionFilter === 'ALL' ? undefined : actionFilter,
          search: searchQuery || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log');
    } finally {
      setIsLoading(false);
    }
  }, [entityFilter, actionFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(load, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, searchQuery]);

  useEffect(() => {
    adminApi
      .getAuditFilters()
      .then(setFilters)
      .catch(() => setFilters({ entities: [], actions: [] }));
  }, [logs.length]);

  return (
    <div className="space-y-6 text-[#2A2A2A]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="h-6 w-6 text-[#064e3b]" />
            <h1 className="text-xl font-serif font-bold text-[#2A2A2A]">Audit Logs & Change History</h1>
          </div>
          <p className="text-xs text-[#6b6661]">
            Who changed what, and when — products, staff accounts, orders, feature flags and store
            settings. Entries are written automatically and never edited.
          </p>
        </div>

        <div className="text-xs font-mono text-[#064e3b] bg-[#064e3b]/10 px-3 py-1.5 rounded-xl border border-[#064e3b]/20 font-bold shrink-0">
          Showing <span className="text-[#C59B27] font-black">{logs.length}</span> entries
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6661]" />
          <input
            type="text"
            placeholder="Search by staff name, entity or record id…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs text-[#2A2A2A] font-medium focus:outline-none focus:border-[#064e3b]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#6b6661]" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs font-bold text-[#2A2A2A]"
          >
            <option value="ALL">All entities</option>
            {filters.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs font-bold text-[#2A2A2A]"
          >
            <option value="ALL">All actions</option>
            {filters.actions.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-[#6b6661] font-medium">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#6b6661] font-medium">
            No activity recorded for these filters yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#2A2A2A] min-w-[820px]">
              <thead className="bg-[#FAF8F3] text-[#6b6661] font-bold border-b border-stone-200 uppercase tracking-wider">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Staff Member</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Entity</th>
                  <th className="px-4 py-3.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="hover:bg-[#FAF8F3]/60 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3.5 text-stone-400">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[#064e3b]" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-[#6b6661] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#2A2A2A]">{log.userName}</div>
                          {log.user?.email && (
                            <div className="text-[10px] text-[#6b6661] font-mono">{log.user.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded font-mono text-[10px] font-black uppercase border ${actionStyle(
                              log.action,
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-[#2A2A2A]">
                          {log.entity}
                          {log.entityId && (
                            <code className="text-[10px] text-[#6b6661] ml-1">({log.entityId})</code>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-[#6b6661]">
                          {log.ipAddress ?? '—'}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#FAF8F3]/80">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="bg-white p-3.5 rounded-xl border border-red-200 shadow-sm">
                                <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2">
                                  − Before
                                </div>
                                <pre className="text-[11px] text-red-900 overflow-x-auto whitespace-pre-wrap">
                                  {log.payloadBefore
                                    ? JSON.stringify(log.payloadBefore, null, 2)
                                    : 'null (new record)'}
                                </pre>
                              </div>

                              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm">
                                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
                                  + After
                                </div>
                                <pre className="text-[11px] text-emerald-900 overflow-x-auto whitespace-pre-wrap">
                                  {log.payloadAfter
                                    ? JSON.stringify(log.payloadAfter, null, 2)
                                    : 'null (record removed)'}
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
        )}
      </div>
    </div>
  );
}
