import React, { useState, useEffect } from 'react';
import { fetchRecurrenceAlerts, fetchIncident } from '../services/api';
import { RecurrenceAlert, Incident } from '../types';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import { HotspotInvestigationModal } from '../components/HotspotInvestigationModal';
import {
  Repeat, AlertTriangle, ShieldCheck, Clock, MapPin,
  CheckCircle2, Info, ArrowRight, Eye, RefreshCw, ShieldAlert
} from 'lucide-react';

export const RecurringFailures: React.FC = () => {
  const [alerts, setAlerts] = useState<RecurrenceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'post_res' | 'cluster'>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [investigatingLocationId, setInvestigatingLocationId] = useState<number | null>(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await fetchRecurrenceAlerts();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleInspect = async (id: string) => {
    try {
      const inc = await fetchIncident(id);
      setSelectedIncident(inc);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === 'post_res') return a.is_post_resolution;
    if (filterType === 'cluster') return !a.is_post_resolution;
    return true;
  });

  const postResCount = alerts.filter((a) => a.is_post_resolution).length;

  return (
    <div className="space-y-6">
      {/* Flagship Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5" />
                <span>Primary Hackathon Innovation</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">Deterministic Spatial & Temporal Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Recurring Waste Failure Intelligence</h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              Standard municipal portals close complaints upon cleanup. WasteTrace AI monitors locations <strong>after</strong> resolution, automatically flagging operational relapses and chronic proximity clusters.
            </p>
          </div>
          <button
            onClick={loadAlerts}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors self-start md:self-auto text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Alerts</span>
          </button>
        </div>
      </div>

      {/* Core Question Answer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Post-Resolution Relapses</span>
            <span className="text-lg font-extrabold text-rose-700">{postResCount}</span>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">
            Critical failures where an incident recurred after a supervisor verified previous cleanup.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Active Proximity Clusters</span>
            <span className="text-lg font-extrabold text-amber-700">{alerts.length - postResCount}</span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Locations experiencing multiple compatible complaints within configured 50m radius.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detection Logic</span>
            <span className="text-xs font-mono font-bold text-emerald-700">100% Explainable</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Haversine geographic proximity, category compatibility matrix, and follow-up time windows.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Recurrence Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setFilterType('post_res')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterType === 'post_res'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Recurrence After Cleanup ({postResCount})</span>
          </button>
          <button
            onClick={() => setFilterType('cluster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'cluster'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Proximity Clusters ({alerts.length - postResCount})
          </button>
        </div>
      </div>

      {/* Recurrence Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border transition-all shadow-2xs ${
                alert.is_post_resolution
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                    alert.is_post_resolution
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {alert.is_post_resolution ? <AlertTriangle className="w-3 h-3" /> : <Repeat className="w-3 h-3" />}
                    <span>{alert.rule_triggered}</span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-700">
                    Category: {alert.category}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Detected on: {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>

              {/* Rationale explanation */}
              <p className="text-xs text-slate-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-200/80 mb-3">
                {alert.explanation}
              </p>

              {/* Related Incidents Pair */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Primary Incident:</span>
                    <button
                      onClick={() => handleInspect(alert.primary_incident_id)}
                      className="font-mono font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                    >
                      <span>{alert.primary_incident_id}</span>
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-slate-300">↔</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Triggered By:</span>
                    <button
                      onClick={() => handleInspect(alert.trigger_incident_id)}
                      className="font-mono font-bold text-rose-700 hover:underline flex items-center gap-0.5"
                    >
                      <span>{alert.trigger_incident_id}</span>
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    • Distance: <strong>{alert.distance_meters}m</strong>
                  </span>
                </div>

                <div className="flex gap-2">
                  {alert.location_id && (
                    <button
                      onClick={() => setInvestigatingLocationId(alert.location_id!)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-emerald-400 hover:bg-slate-800 border border-emerald-500/30 transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Investigate Hotspot</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleInspect(alert.trigger_incident_id)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    Inspect Trigger Incident
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No recurrence alerts match the selected filter.
          </div>
        )}
      </div>

      {/* Hotspot Investigation Modal */}
      <HotspotInvestigationModal
        locationId={investigatingLocationId}
        isOpen={investigatingLocationId !== null}
        onClose={() => setInvestigatingLocationId(null)}
        onSelectIncident={(incId) => {
          setInvestigatingLocationId(null);
          handleInspect(incId);
        }}
      />

      {/* Incident Detail Drawer */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadAlerts();
          if (selectedIncident) {
            handleInspect(selectedIncident.id);
          }
        }}
      />
    </div>
  );
};

