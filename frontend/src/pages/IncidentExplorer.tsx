import React, { useState, useEffect } from 'react';
import { fetchIncidents } from '../services/api';
import { Incident } from '../types';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import {
  Search, Filter, ArrowUpDown, Repeat, AlertTriangle,
  ChevronLeft, ChevronRight, FileCheck, Layers, Eye
} from 'lucide-react';

const CATEGORIES = [
  'All Categories',
  'Overflowing garbage bin',
  'Missed garbage collection',
  'Illegal dumping',
  'Roadside garbage accumulation',
  'Construction waste',
  'Drain blockage caused by waste',
  'Other waste-related issue',
];

const SEVERITIES = ['All Severities', 'Critical', 'High', 'Medium', 'Low'];

const STATUSES = [
  'All Statuses',
  'Reported',
  'Assigned',
  'Cleanup Submitted',
  'Verification Pending',
  'Resolved — Verified',
  'Recurrence Detected',
  'Reopened',
];

export const IncidentExplorer: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [severity, setSeverity] = useState('All Severities');
  const [status, setStatus] = useState('All Statuses');
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const res = await fetchIncidents({
        search: search || undefined,
        category: category !== 'All Categories' ? category : undefined,
        severity: severity !== 'All Severities' ? severity : undefined,
        status: status !== 'All Statuses' ? status : undefined,
        is_recurring: recurringOnly ? true : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      });
      setIncidents(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [page, category, severity, status, recurringOnly, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadIncidents();
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Incident Explorer</h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, filter, and audit municipal waste reports, priority scores, and recurrence flags.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs self-start">
          Total Reports: <span className="font-mono text-slate-900 font-bold">{total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Incident ID, address, title, or keywords..."
            className="w-full text-xs pl-9 pr-24 py-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-xl border border-slate-300 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-xl border border-slate-300 bg-white"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="p-2 rounded-xl border border-slate-300 bg-white"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-');
              setSortBy(sb);
              setSortOrder(so);
              setPage(1);
            }}
            className="p-2 rounded-xl border border-slate-300 bg-white"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="priority_score-desc">Highest Priority</option>
            <option value="priority_score-asc">Lowest Priority</option>
            <option value="severity-desc">Severity</option>
          </select>

          <div className="col-span-2 sm:col-span-1 flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <input
              type="checkbox"
              id="recOnly"
              checked={recurringOnly}
              onChange={(e) => {
                setRecurringOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <label htmlFor="recOnly" className="text-xs text-slate-700 cursor-pointer font-medium flex items-center gap-1">
              <Repeat className="w-3 h-3 text-rose-500" />
              <span>Recurring Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">ID & Recurrence</th>
                <th className="py-3 px-3.5">Title & Location</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Severity</th>
                <th className="py-3 px-3.5">Priority</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Reported</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading incident records...
                  </td>
                </tr>
              ) : incidents.length > 0 ? (
                incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3.5">
                      <div className="font-mono font-bold text-slate-900">{inc.id}</div>
                      {inc.is_recurring && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                          <Repeat className="w-2.5 h-2.5 text-rose-600" />
                          <span>{inc.recurrence_count}x recurring</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-slate-900">{inc.title}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{inc.address_text}</div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 font-medium">{inc.category}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        inc.severity === 'Critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        inc.severity === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        inc.severity === 'Medium' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{inc.priority_score.toFixed(0)}</span>
                        <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              inc.priority_score >= 80 ? 'bg-rose-500' :
                              inc.priority_score >= 60 ? 'bg-amber-500' :
                              inc.priority_score >= 40 ? 'bg-blue-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${inc.priority_score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        inc.status === 'Resolved — Verified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        inc.status === 'Recurrence Detected' ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' :
                        inc.status === 'Verification Pending' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(inc.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No incidents matched the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} records)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Incident Detail Drawer */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadIncidents();
          if (selectedIncident) {
            fetchIncidents({ page: 1, page_size: 100 }).then((res) => {
              const updated = res.items.find((i) => i.id === selectedIncident.id);
              if (updated) setSelectedIncident(updated);
            });
          }
        }}
      />
    </div>
  );
};

