import React, { useState, useEffect } from 'react';
import {
  X, AlertTriangle, CheckCircle2, Clock, MapPin, ShieldAlert,
  HelpCircle, RefreshCw, Layers, ArrowRight, UserCheck, Calendar, FileText
} from 'lucide-react';
import { HotspotInvestigationResponse } from '../types';
import { fetchHotspotInvestigation } from '../services/api';

interface HotspotInvestigationModalProps {
  locationId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

export const HotspotInvestigationModal: React.FC<HotspotInvestigationModalProps> = ({
  locationId,
  isOpen,
  onClose,
  onSelectIncident,
}) => {
  const [data, setData] = useState<HotspotInvestigationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'root_cause' | 'timeline' | 'cleanups' | 'open_cases'>('root_cause');

  useEffect(() => {
    if (!isOpen || !locationId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetchHotspotInvestigation(locationId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load hotspot investigation');
        setLoading(false);
      });
  }, [isOpen, locationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {data?.location.name || 'Hotspot Investigation'}
                </h2>
                {data?.location.is_demo && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                    East Delhi Scenario
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {data?.location.address} • Zone: <span className="text-slate-300 font-medium">{data?.location.zone}</span>
                {data?.location && (
                  <span className="text-slate-500">
                    ({data.location.latitude.toFixed(4)}, {data.location.longitude.toFixed(4)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm text-slate-400">Executing diagnostic engine across municipal history...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Diagnostic Failure</p>
                <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-xs text-slate-400">Total Historical</span>
                  <div className="text-xl font-bold text-white mt-1">
                    {data.root_cause_analysis.total_incidents}
                  </div>
                  <span className="text-[10px] text-slate-500">Recorded cases</span>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-xs text-slate-400">Open Incidents</span>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {data.root_cause_analysis.open_incidents_count}
                  </div>
                  <span className="text-[10px] text-amber-500/70">Awaiting clearance</span>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-xs text-slate-400">Post-Resolution Relapses</span>
                  <div className="text-xl font-bold text-rose-400 mt-1 flex items-center gap-1.5">
                    {data.root_cause_analysis.post_resolution_relapse_count}
                    {data.root_cause_analysis.post_resolution_relapse_count > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-rose-400/80">
                    MTBR: {data.root_cause_analysis.mean_time_to_relapse_days != null ? `${data.root_cause_analysis.mean_time_to_relapse_days}d avg` : 'N/A'}
                  </span>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-xs text-slate-400">Dominant Category</span>
                  <div className="text-sm font-bold text-emerald-400 mt-1 truncate" title={data.root_cause_analysis.dominant_category}>
                    {data.root_cause_analysis.dominant_category}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {data.root_cause_analysis.dominant_category_percentage}% concentration
                  </span>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-xs text-slate-400">Evidence Compliance</span>
                  <div className="text-xl font-bold text-cyan-400 mt-1">
                    {data.root_cause_analysis.evidence_compliance_percentage}%
                  </div>
                  <span className="text-[10px] text-slate-500">Verified cleanups</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800 space-x-1">
                <button
                  onClick={() => setActiveTab('root_cause')}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'root_cause'
                      ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Root Cause Intelligence (4-Part Audit)
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'timeline'
                      ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Chronological Event Stream ({data.timeline.length})
                </button>
                <button
                  onClick={() => setActiveTab('cleanups')}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'cleanups'
                      ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Cleanups & Evidence ({data.cleanups.length})
                </button>
                <button
                  onClick={() => setActiveTab('open_cases')}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'open_cases'
                      ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Open Incidents ({data.open_incidents.length})
                </button>
              </div>

              {/* Tab 1: Root Cause Intelligence (Structured 4-Part Evidence) */}
              {activeTab === 'root_cause' && (
                <div className="space-y-6">
                  {/* Part A: Verified Observations */}
                  <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          Part A: Verified Observations
                        </h3>
                      </div>
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                        Grounded in Database Records & Metrics
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {data.root_cause_analysis.verified_observations.map((obs, idx) => (
                        <div key={idx} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                          <p className="text-xs text-slate-200 leading-relaxed font-medium">{obs.text}</p>
                          {obs.supporting_incidents && obs.supporting_incidents.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Supporting IDs:</span>
                              {obs.supporting_incidents.map((id) => (
                                <button
                                  key={id}
                                  onClick={() => onSelectIncident && onSelectIncident(id)}
                                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono transition"
                                >
                                  {id}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Part B: Plausible Hypotheses */}
                  <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          Part B: Plausible Hypotheses
                        </h3>
                      </div>
                      <span className="text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-medium">
                        Operational Inferences with Caveats
                      </span>
                    </div>

                    <div className="space-y-3">
                      {data.root_cause_analysis.plausible_hypotheses.map((hyp, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                          <div className="flex items-start space-x-2">
                            <span className="text-cyan-400 text-xs font-bold shrink-0 mt-0.5">H{idx + 1}:</span>
                            <p className="text-xs text-white font-semibold">{hyp.hypothesis}</p>
                          </div>
                          <div className="text-[11px] text-slate-300 bg-slate-800/40 p-2 rounded border border-slate-700/50">
                            <span className="text-slate-400 font-semibold">Observed Grounds: </span>
                            {hyp.grounds}
                          </div>
                          <div className="text-[11px] text-amber-300/90 bg-amber-500/5 p-2 rounded border border-amber-500/20 flex items-start space-x-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              <strong className="text-amber-400">Caveat: </strong>
                              {hyp.caveat}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Part C: Missing Information (Data Gaps) */}
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <HelpCircle className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                          Part C: Missing Information & Telemetry Gaps
                        </h3>
                      </div>
                      <span className="text-[11px] text-amber-400/90 font-mono">
                        No Data Fabrication Rule Enforced
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      The following municipal operational records are currently unavailable in the database.
                      Definitive root causes cannot be asserted without these primary sources:
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {data.root_cause_analysis.missing_information.map((item, idx) => (
                        <li key={idx} className="flex items-start space-x-2 bg-slate-900/50 p-2 rounded border border-slate-800">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Part D: Explainable Recommendations */}
                  <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          Part D: Explainable Operational Actions
                        </h3>
                      </div>
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                        Measured Actions & Field Verifications
                      </span>
                    </div>

                    <div className="space-y-3">
                      {data.root_cause_analysis.recommendations.map((rec) => (
                        <div key={rec.id} className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                                {rec.id}
                              </span>
                              <h4 className="text-xs font-bold text-white">{rec.action}</h4>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              rec.confidence === 'High'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {rec.confidence} Confidence
                            </span>
                          </div>

                          <p className="text-xs text-slate-300">{rec.rationale}</p>

                          {rec.supporting_incidents && rec.supporting_incidents.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] text-slate-400">Supporting Incidents:</span>
                              {rec.supporting_incidents.map((id) => (
                                <span key={id} className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                                  {id}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="text-[11px] text-cyan-300/90 bg-cyan-500/5 p-2 rounded border border-cyan-500/20 flex items-start space-x-1.5 mt-2">
                            <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span>
                              <strong className="text-cyan-400">Verification Required Before Capital Spend: </strong>
                              {rec.verification_needed}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Chronological Event Stream */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-800/40 rounded-lg text-xs text-slate-400 border border-slate-700/60">
                    Complete verifiable chronological event log of citizen reports, worker dispatches, cleanups, supervisor verifications, and relapse triggers for this location.
                  </div>

                  <div className="relative pl-6 border-l border-slate-700 space-y-4 my-2">
                    {data.timeline.map((evt, idx) => {
                      const isRelapse = evt.event_type.includes('RELAPSE');
                      const isVerified = evt.event_type.includes('VERIFIED');
                      const isAssigned = evt.event_type.includes('ASSIGNED');

                      return (
                        <div key={idx} className="relative group">
                          {/* Dot on line */}
                          <div className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 ${
                            isRelapse
                              ? 'bg-rose-500 border-rose-900 ring-2 ring-rose-500/30'
                              : isVerified
                              ? 'bg-emerald-500 border-emerald-900 ring-2 ring-emerald-500/30'
                              : isAssigned
                              ? 'bg-cyan-500 border-cyan-900'
                              : 'bg-slate-400 border-slate-800'
                          }`} />

                          <div className="bg-slate-800/40 hover:bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 transition">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                                isRelapse
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : isVerified
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isAssigned
                                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-slate-700 text-slate-300'
                              }`}>
                                {evt.event_type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'N/A'}
                              </span>
                            </div>

                            <p className="text-xs text-white font-medium mt-1.5">{evt.details}</p>

                            {evt.incident_id && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-slate-500 font-mono">Incident ID:</span>
                                <button
                                  onClick={() => onSelectIncident && evt.incident_id && onSelectIncident(evt.incident_id)}
                                  className="text-[10px] font-mono text-emerald-400 hover:underline"
                                >
                                  {evt.incident_id}
                                </button>
                                {evt.is_demo && (
                                  <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 rounded">Synthetic</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Cleanups & Verification History */}
              {activeTab === 'cleanups' && (
                <div className="space-y-4">
                  {data.cleanups.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-800/30 rounded-xl">
                      No photographic cleanup records have been submitted for this location yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.cleanups.map((cl) => (
                        <div key={cl.evidence_id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-400">
                              Cleanup #{cl.evidence_id} • {cl.incident_id}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              cl.is_verified
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {cl.is_verified ? 'Verified Clean' : 'Pending Verification'}
                            </span>
                          </div>

                          {cl.image_url ? (
                            <img
                              src={cl.image_url}
                              alt="Cleanup photographic evidence"
                              className="w-full h-44 object-cover rounded-lg border border-slate-700 bg-slate-900"
                            />
                          ) : (
                            <div className="w-full h-32 bg-slate-900 rounded-lg flex items-center justify-center text-slate-600 text-xs border border-slate-800">
                              No image attached
                            </div>
                          )}

                          <div className="space-y-1 text-xs">
                            <p className="text-slate-300">
                              <span className="text-slate-500 font-semibold">Crew Notes: </span>
                              {cl.notes || 'None'}
                            </p>
                            <p className="text-slate-400 text-[11px]">
                              Submitted by: <span className="text-slate-300 font-medium">{cl.submitted_by_role}</span>
                              {cl.cleanup_timestamp && ` on ${new Date(cl.cleanup_timestamp).toLocaleString()}`}
                            </p>
                            {cl.verified_at && (
                              <p className="text-emerald-400 text-[11px]">
                                Verified by: <span className="font-medium">{cl.verified_by_role}</span> on {new Date(cl.verified_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Open Incidents */}
              {activeTab === 'open_cases' && (
                <div className="space-y-3">
                  {data.open_incidents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-800/30 rounded-xl">
                      All incidents at this hotspot have been successfully cleaned and verified.
                    </div>
                  ) : (
                    data.open_incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between hover:bg-slate-800/70 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-emerald-400">{inc.id}</span>
                            <span className="text-xs font-bold text-white">{inc.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              inc.severity === 'Critical'
                                ? 'bg-rose-500/20 text-rose-400'
                                : inc.severity === 'High'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {inc.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            Category: <span className="text-slate-300">{inc.category}</span> • Status: <span className="text-amber-400 font-medium">{inc.status}</span>
                            {inc.assigned_to && (
                              <span className="text-cyan-400 ml-2">Assigned to: {inc.assigned_to}</span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">Priority Score</span>
                            <div className="text-sm font-bold text-white">{inc.priority_score.toFixed(1)}</div>
                          </div>
                          {onSelectIncident && (
                            <button
                              onClick={() => onSelectIncident(inc.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              Inspect Case <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <div>
            Evidence grounded against East Delhi municipal records. AI models cannot override measured relapse data.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition"
          >
            Close Investigation
          </button>
        </div>
      </div>
    </div>
  );
};

