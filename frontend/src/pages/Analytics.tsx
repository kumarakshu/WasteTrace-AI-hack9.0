import React, { useState, useEffect } from 'react';
import { fetchDashboardSummary, fetchLocations } from '../services/api';
import { DashboardSummary, LocationItem } from '../types';
import {
  BarChart3, PieChart as PieIcon, TrendingUp, Download,
  CheckCircle2, AlertTriangle, Layers, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export const Analytics: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboardSummary(), fetchLocations()])
      .then(([s, l]) => {
        setSummary(s);
        setLocations(l);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const SEVERITY_COLORS: Record<string, string> = {
    Critical: '#e11d48',
    High: '#f59e0b',
    Medium: '#3b82f6',
    Low: '#10b981',
  };

  const categoryChartData = summary
    ? Object.entries(summary.category_distribution).map(([name, count]) => ({
        name: name.replace('waste', '').replace('caused by waste', '').trim(),
        count,
      }))
    : [];

  const statusChartData = summary
    ? Object.entries(summary.status_distribution).map(([name, count]) => ({
        name,
        count,
      }))
    : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics & Intelligence Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated operational metrics, spatial recurrence patterns, and resolution KPIs.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Summary Report</span>
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Reported</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{summary?.total_incidents || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Municipal database records</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Resolution Rate</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{summary?.resolution_rate_percent || 0}%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Verified cleanups</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recurring Hotspots</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{summary?.recurring_locations || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Sites with multi-incident clusters</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Post-Cleanup Relapse</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{summary?.recurrence_after_resolution || 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Recurrence within 30 days</div>
        </div>
      </div>

      {/* Chart Row 1: Category Bar & Status Pipeline Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <h3 className="font-bold text-slate-900 text-sm mb-1">Waste Categories Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Volume of complaints by specific operational issue type</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <h3 className="font-bold text-slate-900 text-sm mb-1">Status Pipeline Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Lifecycle progression from submission to verification</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Locations Summary Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-sm mb-1">District Zone Recurrence Matrix</h3>
        <p className="text-xs text-slate-500 mb-4">Monitoring locations ranked by priority score and recurrence count</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Location Name</th>
                <th className="py-2.5 px-3">District Zone</th>
                <th className="py-2.5 px-3">Active Incidents</th>
                <th className="py-2.5 px-3">Recurrence Alerts</th>
                <th className="py-2.5 px-3">Highest Severity</th>
                <th className="py-2.5 px-3">Max Priority Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{loc.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{loc.zone}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">{loc.active_incidents_count}</td>
                  <td className="py-2.5 px-3">
                    {loc.recurrence_count > 0 ? (
                      <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        {loc.recurrence_count} alerts
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      loc.highest_severity === 'Critical' ? 'bg-rose-100 text-rose-800' :
                      loc.highest_severity === 'High' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {loc.highest_severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {loc.highest_priority_score.toFixed(0)} / 100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

