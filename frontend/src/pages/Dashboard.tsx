import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchDashboardSummary, fetchIncidents, fetchRecurrenceAlerts,
  fetchLocations, reseedDemoData
} from '../services/api';
import { DashboardSummary, Incident, RecurrenceAlert, LocationItem } from '../types';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import {
  AlertTriangle, Repeat, ShieldCheck, Clock, CheckCircle2,
  TrendingUp, Sparkles, ArrowRight, RefreshCw, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<RecurrenceAlert[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [reseeding, setReseeding] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sum, incs, alr, locs] = await Promise.all([
        fetchDashboardSummary(),
        fetchIncidents({ page: 1, page_size: 6, sort_by: 'created_at', sort_order: 'desc' }),
        fetchRecurrenceAlerts(),
        fetchLocations(),
      ]);
      setSummary(sum);
      setRecentIncidents(incs.items);
      setAlerts(alr.slice(0, 5));
      setLocations(locs.sort((a, b) => b.highest_priority_score - a.highest_priority_score).slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReseed = async () => {
    try {
      setReseeding(true);
      await reseedDemoData();
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setReseeding(false);
    }
  };

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

  const severityChartData = summary
    ? Object.entries(summary.severity_distribution).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner: Civic Mission & Reseed */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
              East Delhi Operations MVP
            </span>
            <span className="text-xs text-emerald-200 font-medium">Laxmi Nagar • Nirman Vihar • Preet Vihar</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Waste Management Intelligence</h1>
          <p className="text-sm text-emerald-100 max-w-2xl mt-1 leading-relaxed">
            "Don't just close complaints. Verify that the problem stays solved." Monitor recurring waste clusters, prioritize dispatch with explainable scores, and audit cleanup evidence across East Delhi.
          </p>
          <div className="mt-2 text-[11px] font-mono text-emerald-200/90 bg-emerald-950/40 px-2.5 py-1 rounded-md inline-block border border-emerald-400/20">
            DEMO DATA — Synthetic incidents at real geographic locations.
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReseed}
            disabled={reseeding}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors backdrop-blur-xs text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reseeding ? 'animate-spin' : ''}`} />
            <span>{reseeding ? 'Reseeding...' : 'Reset Demo Dataset'}</span>
          </button>
          <Link
            to="/report"
            className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-colors shadow-xs"
          >
            + Report Incident
          </Link>
        </div>
      </div>

      {/* Top KPI Cards (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Incidents</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{summary?.total_incidents ?? '...'}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            <span>Across all sectors</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Open Incidents</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{summary?.open_incidents ?? '...'}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Pending resolution</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recurring Hotspots</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{summary?.recurring_locations ?? '...'}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Repeat className="w-3 h-3 text-rose-500" />
            <span>Locations with ≥2 issues</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">High Priority</div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">{summary?.high_priority_incidents ?? '...'}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-indigo-500" />
            <span>Score ≥ 60.0</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verified Resolutions</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{summary?.verified_resolutions ?? '...'}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>{summary?.resolution_rate_percent}% verified</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Relapsed Cleanups</div>
          <div className="text-2xl font-extrabold text-rose-800 mt-1">{summary?.recurrence_after_resolution ?? '...'}</div>
          <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
            <Repeat className="w-3 h-3 text-rose-600" />
            <span>Post-resolution alerts</span>
          </div>
        </div>
      </div>

      {/* Charts Section: Category Bar & Severity Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Incidents by Waste Category</h3>
              <p className="text-xs text-slate-500">Distribution of reports across municipal problem types</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {summary?.total_incidents || 0} Total
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Severity Ratio</h3>
                <p className="text-xs text-slate-500">Proportion of hazard tiers</p>
              </div>
            </div>
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityChartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
            {severityChartData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[s.name] || '#94a3b8' }} />
                <span className="text-slate-600 font-medium">{s.name}:</span>
                <span className="font-bold text-slate-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Grid: High Priority Locations & Recurrence Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Highest Priority Locations */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Highest Priority Locations</span>
              </h3>
              <p className="text-xs text-slate-500">Ranked by transparent scoring formula</p>
            </div>
            <Link to="/map" className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
              <span>View Map</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-slate-900">{loc.name}</div>
                  <div className="text-[11px] text-slate-500">{loc.address}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {loc.active_incidents_count} active
                    </span>
                    {loc.recurrence_count > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                        {loc.recurrence_count} recurring
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-slate-900">
                    Score: {loc.highest_priority_score.toFixed(0)}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    loc.highest_priority_score >= 80 ? 'bg-rose-100 text-rose-800' :
                    loc.highest_priority_score >= 60 ? 'bg-amber-100 text-amber-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {loc.highest_severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Recurrence Alerts */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Repeat className="w-4 h-4 text-rose-600" />
                <span>Recent Recurrence Detections</span>
              </h3>
              <p className="text-xs text-slate-500">Automated spatial and post-cleanup triggers</p>
            </div>
            <Link to="/recurrence" className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
              <span>All Alerts</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    alert.is_post_resolution
                      ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                      : 'bg-amber-50/80 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      {alert.is_post_resolution ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Post-Resolution Relapse</span>
                        </>
                      ) : (
                        <>
                          <Repeat className="w-3.5 h-3.5 text-amber-600" />
                          <span>Proximity Recurrence</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] font-mono font-medium opacity-75">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{alert.explanation}</p>
                  <div className="flex items-center gap-2 pt-1 font-mono text-[10px] opacity-80">
                    <span>Triggers: {alert.primary_incident_id} ↔ {alert.trigger_incident_id}</span>
                    <span>• Proximity: {alert.distance_meters}m</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No recurrence alerts generated yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Reported Incidents Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recently Reported Incidents</h3>
            <p className="text-xs text-slate-500">Latest citizen submissions and field logs</p>
          </div>
          <Link to="/incidents" className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
            <span>Open Explorer</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Title & Location</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Priority Score</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{inc.id}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-900">{inc.title}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{inc.address_text}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{inc.category}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                      inc.severity === 'Critical' ? 'bg-rose-100 text-rose-800' :
                      inc.severity === 'High' ? 'bg-amber-100 text-amber-800' :
                      inc.severity === 'Medium' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {inc.priority_score.toFixed(0)} / 100
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      inc.status === 'Resolved — Verified' ? 'bg-emerald-100 text-emerald-800' :
                      inc.status === 'Recurrence Detected' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setSelectedIncident(inc)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadData();
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

