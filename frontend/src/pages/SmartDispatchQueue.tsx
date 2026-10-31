import React, { useState, useEffect } from 'react';
import {
  Truck, AlertTriangle, ShieldAlert, CheckCircle2, Search,
  Filter, ArrowUpDown, MapPin, RefreshCw, UserCheck, Layers, ChevronRight
} from 'lucide-react';
import { DispatchQueueItem, DispatchQueueResponse, UserRole, Incident } from '../types';
import { useRole } from '../context/RoleContext';
import { fetchDispatchQueue, assignDispatchWorker, fetchIncident } from '../services/api';
import { HotspotInvestigationModal } from '../components/HotspotInvestigationModal';
import { IncidentDetailModal } from '../components/IncidentDetailModal';

const DEMO_SANITATION_UNITS = [
  'East Delhi Rapid Response Unit 1 (Vikas Marg)',
  'Sanitation Crew Alpha (Heavy Compactor)',
  'Commercial Market Collection Unit 2 (Preet Vihar)',
  'Drainage Desilting Unit 3 (Ghazipur/Pandav Nagar)',
  'Emergency Flyover Clearance Squad (Anand Vihar)',
  'Ward 204 Routine Sweeping Team (Shakarpur)',
];

interface SmartDispatchQueueProps {
  currentRole?: UserRole;
}

export const SmartDispatchQueue: React.FC<SmartDispatchQueueProps> = ({ currentRole }) => {
  const { role: contextRole } = useRole();
  const role = currentRole || contextRole;
  const [queueData, setQueueData] = useState<DispatchQueueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [investigatingLocationId, setInvestigatingLocationId] = useState<number | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const handleInspectCase = async (id: string) => {
    try {
      const inc = await fetchIncident(id);
      setSelectedIncident(inc);
    } catch (err: any) {
      alert(`Failed to load incident details: ${err.message}`);
    }
  };

  const loadQueue = () => {
    setLoading(true);
    setError(null);
    fetchDispatchQueue({
      status: statusFilter || undefined,
      priority_level: priorityFilter || undefined,
      zone: zoneFilter || undefined,
      unassigned_only: unassignedOnly,
    })
      .then((data) => {
        setQueueData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load dispatch queue');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadQueue();
  }, [statusFilter, priorityFilter, zoneFilter, unassignedOnly]);

  const handleAssignWorker = async (incidentId: string, assignedTo: string) => {
    try {
      await assignDispatchWorker({
        incident_id: incidentId,
        assigned_to: assignedTo,
        role: role,
        notes: `Assigned to ${assignedTo} via Smart Dispatch Queue by ${role}`,
      });

      setToastMessage(`Incident ${incidentId} successfully assigned to ${assignedTo}`);
      setTimeout(() => setToastMessage(null), 4000);

      // Refresh list
      loadQueue();
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`);
    }
  };

  // Filter items by client-side search query
  const filteredItems = (queueData?.items || []).filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.location_name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.assigned_to && item.assigned_to.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500/90 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-emerald-400 backdrop-blur-md animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">Smart Dispatch Queue</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Priority Enforced
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Evidence-ranked municipal work queue for East Delhi rapid response units, compactor crews, and drainage squads.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadQueue}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Metric Counters Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Total Active Queue</span>
          <div className="text-2xl font-bold text-white mt-1">{queueData?.total ?? 0}</div>
          <span className="text-[11px] text-slate-500">Unresolved complaints</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Critical Emergencies</span>
          <div className="text-2xl font-bold text-rose-400 mt-1 flex items-center gap-2">
            {queueData?.critical_count ?? 0}
            {(queueData?.critical_count ?? 0) > 0 && (
              <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-mono font-bold">
                Urgent
              </span>
            )}
          </div>
          <span className="text-[11px] text-rose-400/80">Immediate clearance required</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">High Priority Hotspots</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{queueData?.high_count ?? 0}</div>
          <span className="text-[11px] text-slate-500">Repeated relapses</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Unassigned Cases</span>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{queueData?.unassigned_count ?? 0}</div>
          <span className="text-[11px] text-cyan-400/80">Requires unit dispatch</span>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, title, East Delhi neighborhood, crew..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Priority Levels</option>
              <option value="Critical">Critical Priority</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Statuses (Active)</option>
              <option value="Reported">Reported</option>
              <option value="Recurrence Detected">Recurrence Detected</option>
              <option value="Assigned">Assigned</option>
              <option value="Verification Pending">Verification Pending</option>
            </select>
          </div>

          {/* Unassigned toggle */}
          <div className="flex items-center">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(e) => setUnassignedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 bg-slate-800"
              />
              <span className="font-semibold">Unassigned Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Queue Items Table / Cards */}
      <div className="space-y-3">
        {loading && (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs">Optimizing dispatch queue by priority and recurrence score...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">No complaints match current dispatch filter</h3>
            <p className="text-xs text-slate-400">All matching incidents have been resolved or filter is too restrictive.</p>
          </div>
        )}

        {!loading && filteredItems.map((item) => {
          const isCritical = item.severity === 'Critical' || item.priority_level === 'Critical';

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition duration-200 ${
                isCritical
                  ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70'
                  : item.is_recurring
                  ? 'bg-slate-900/80 border-amber-500/30 hover:border-amber-500/60'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left block: Priority Score Gauge & Title */}
                <div className="flex items-start space-x-3.5 flex-1">
                  {/* Priority Gauge */}
                  <div className={`p-2.5 rounded-xl flex flex-col items-center justify-center min-w-[62px] text-center border ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 ring-2 ring-rose-500/20'
                      : item.priority_level === 'High'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider">Score</span>
                    <span className="text-lg font-black">{item.priority_score.toFixed(1)}</span>
                    <span className="text-[9px] font-bold uppercase">{item.priority_level}</span>
                  </div>

                  {/* Incident Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">{item.id}</span>
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>

                      {item.is_recurring && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Relapsed {item.recurrence_count}x
                        </span>
                      )}

                      {item.is_demo && (
                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Demo Scenario
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="text-slate-300 font-medium">{item.category}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {item.location_name}
                      </span>
                      <span>•</span>
                      <span>Status: <strong className="text-slate-200">{item.status}</strong></span>
                    </div>

                    {/* Operational Recommendation Banner */}
                    <div className="text-[11px] bg-slate-800/60 p-2 rounded-lg border border-slate-700/60 text-slate-300 flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        <strong className="text-emerald-400">Next Action: </strong>
                        {item.recommended_action}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right block: Crew Assignment & Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                  {/* Worker Assignment Dropdown */}
                  <div className="min-w-[240px]">
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                      Assigned Field Response Unit:
                    </label>
                    <select
                      value={item.assigned_to || ''}
                      onChange={(e) => handleAssignWorker(item.id, e.target.value)}
                      className={`w-full text-xs rounded-lg px-2.5 py-1.5 border font-medium focus:outline-none focus:border-emerald-500 transition ${
                        item.assigned_to
                          ? 'bg-slate-800/90 text-cyan-300 border-cyan-500/40'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      <option value="">-- Unassigned (Click to Assign) --</option>
                      {DEMO_SANITATION_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-end space-x-1.5 self-end sm:self-auto">
                    {item.location_id && (
                      <button
                        onClick={() => setInvestigatingLocationId(item.location_id!)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition"
                        title="Open 4-part root cause intelligence & event timeline"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Investigate Hotspot</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleInspectCase(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <span>Case Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hotspot Investigation Modal */}
      <HotspotInvestigationModal
        locationId={investigatingLocationId}
        isOpen={investigatingLocationId !== null}
        onClose={() => setInvestigatingLocationId(null)}
        onSelectIncident={(incId) => {
          setInvestigatingLocationId(null);
          handleInspectCase(incId);
        }}
      />

      {/* Incident Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadQueue();
          if (selectedIncident) {
            handleInspectCase(selectedIncident.id);
          }
        }}
      />
    </div>
  );
};
