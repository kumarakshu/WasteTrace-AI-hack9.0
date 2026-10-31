import React, { useState, useEffect } from 'react';
import { fetchAIInsights, fetchIncident, runAgentAudit, fetchLocations } from '../services/api';
import { AIInsight, Incident, LocationItem } from '../types';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import {
  Sparkles, AlertTriangle, CheckCircle, ArrowRight,
  ShieldAlert, Layers, RefreshCw, Eye, Bot, Terminal,
  Play, FileText, CheckCheck, Database, MapPin
} from 'lucide-react';

export const AIInsights: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'insights' | 'agent'>('insights');
  
  // Pattern Insights State
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Agent State
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedAuditType, setSelectedAuditType] = useState<string>('recurrence_audit');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [runningAgent, setRunningAgent] = useState(false);
  const [agentAuditResult, setAgentAuditResult] = useState<any | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const loadInsights = async () => {
    try {
      setLoadingInsights(true);
      const data = await fetchAIInsights();
      setInsights(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadLocations = async () => {
    try {
      const locs = await fetchLocations();
      setLocations(locs);
      if (locs.length > 0 && !selectedLocationId) {
        setSelectedLocationId(String(locs[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInsights();
    loadLocations();
  }, []);

  const handleInspect = async (id: string) => {
    try {
      const inc = await fetchIncident(id);
      setSelectedIncident(inc);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunAgent = async (type?: string) => {
    const targetType = type || selectedAuditType;
    try {
      setRunningAgent(true);
      setAgentError(null);
      const targetParam = (targetType === 'location_deep_dive' || targetType === 'root_cause_audit') ? selectedLocationId : undefined;
      const res = await runAgentAudit(targetType, targetParam);
      setAgentAuditResult(res);
    } catch (err: any) {
      console.error(err);
      setAgentError(err.message || 'Agent audit failed');
    } finally {
      setRunningAgent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Grounded Intelligence</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">Zero Hallucination Protocol</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Insights & Autonomous Agent</h1>
          <p className="text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
            Rigorous, explainable intelligence grounded in actual database records. Correlate spatial clusters, verify cleanup accountability, and run controlled tool-calling agent audits.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-xl border border-white/20 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'insights'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pattern Analysis</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('agent');
              if (!agentAuditResult) handleRunAgent('recurrence_audit');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'agent'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>Operational Agent</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: GROUNDED PATTERN ANALYSIS */}
      {/* ======================================================== */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs text-slate-500 font-medium">
              Showing {insights.length} operational patterns identified from live municipal telemetry
            </div>
            <button
              onClick={loadInsights}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-slate-700 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
              <span>Refresh Insights</span>
            </button>
          </div>

          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-5 rounded-2xl border shadow-2xs space-y-3.5 ${
                  insight.severity === 'Critical' ? 'bg-rose-50/60 border-rose-200' :
                  insight.severity === 'High' ? 'bg-amber-50/60 border-amber-200' :
                  'bg-white border-slate-200'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      insight.severity === 'Critical' ? 'bg-rose-600 text-white' :
                      insight.severity === 'High' ? 'bg-amber-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {insight.severity} Priority
                    </span>
                    <h3 className="font-bold text-sm text-slate-900">{insight.title}</h3>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {insight.locations_affected} location(s) affected
                  </span>
                </div>

                {/* Pattern Observed */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                    Observed Operational Pattern
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {insight.pattern}
                  </p>
                </div>

                {/* Why It Matters */}
                <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                    Why This Pattern Matters
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {insight.why_it_matters}
                  </p>
                </div>

                {/* Suggested Action */}
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Recommended Action</span>
                  </div>
                  <p className="text-xs leading-relaxed font-semibold">
                    {insight.suggested_action}
                  </p>
                </div>

                {/* Supporting Records & Limitations */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">Supporting Incident Records:</span>
                    <div className="flex flex-wrap gap-1 font-mono">
                      {insight.supporting_incidents.map((id) => (
                        <button
                          key={id}
                          onClick={() => handleInspect(id)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 italic max-w-md">
                    <strong>Limitation:</strong> {insight.limitations_and_uncertainty}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: OPERATIONAL INTELLIGENCE AGENT */}
      {/* ======================================================== */}
      {activeTab === 'agent' && (
        <div className="space-y-6">
          {/* Agent Control Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Deterministic Operational Agent</h3>
                  <p className="text-xs text-slate-500">
                    Executes validated SQL and geospatial tools to audit patterns, verification rates, and SLA adherence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  7 Tools Registered
                </span>
              </div>
            </div>

            {/* Audit Trigger Form */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-700">Select Audit Workflow</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'recurrence_audit', label: 'Recurrence Audit' },
                    { id: 'root_cause_audit', label: 'Root Cause Audit' },
                    { id: 'dispatch_queue_audit', label: 'Dispatch Queue' },
                    { id: 'resolution_audit', label: 'SLA & Evidence' },
                    { id: 'location_deep_dive', label: 'Site Timeline' },
                    { id: 'priority_audit', label: 'Priority Safeguard' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => {
                        setSelectedAuditType(btn.id);
                        if (btn.id !== 'location_deep_dive' && btn.id !== 'root_cause_audit') {
                          handleRunAgent(btn.id);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                        selectedAuditType === btn.id
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {(selectedAuditType === 'location_deep_dive' || selectedAuditType === 'root_cause_audit') ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Target Location</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.active_incidents_count} active, {loc.recurrence_count} alerts)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-end">
                  <button
                    onClick={() => handleRunAgent()}
                    disabled={runningAgent}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${runningAgent ? 'animate-spin' : ''}`} />
                    <span>{runningAgent ? 'Executing Tools...' : 'Run Audit Now'}</span>
                  </button>
                </div>
              )}
            </div>

            {(selectedAuditType === 'location_deep_dive' || selectedAuditType === 'root_cause_audit') && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => handleRunAgent(selectedAuditType)}
                  disabled={runningAgent}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${runningAgent ? 'animate-spin' : ''}`} />
                  <span>
                    {runningAgent
                      ? 'Analyzing Site...'
                      : selectedAuditType === 'root_cause_audit'
                      ? 'Execute Root Cause Analysis'
                      : 'Execute Site Timeline Audit'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {agentError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{agentError}</span>
            </div>
          )}

          {/* Audit Results */}
          {agentAuditResult && (
            <div className="space-y-5">
              {/* Executive Summary Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-600 font-bold">
                      Audit Execution Output
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {agentAuditResult.findings?.audit_title || 'Operational Audit'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <span>Generated: {new Date(agentAuditResult.generated_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Key Observations */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Key Empirical Observations</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {agentAuditResult.findings?.key_observations?.map((obs: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="font-bold text-indigo-600 text-xs">#{idx + 1}</span>
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Verified Facts vs Hypotheses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      <span>Verified Grounded Facts (Database-Backed)</span>
                    </h4>
                    <ul className="space-y-1 text-xs text-emerald-950 font-medium">
                      {agentAuditResult.findings?.verified_facts?.map((fact: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Operational Hypotheses (Requires Verification)</span>
                    </h4>
                    <ul className="space-y-1 text-xs text-amber-950">
                      {agentAuditResult.findings?.operational_hypotheses?.map((hyp: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{hyp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommended Municipal Actions */}
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                    <span>Recommended Municipal Interventions</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {agentAuditResult.findings?.recommended_municipal_actions?.map((act: string, idx: number) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs text-xs text-indigo-950 font-medium">
                        <span className="font-bold text-indigo-600 block mb-1">Step {idx + 1}</span>
                        {act}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tool Execution Proof / Telemetry */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-md space-y-3 font-mono">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                    <Terminal className="w-4 h-4" />
                    <span>Tool Execution Proofs ({agentAuditResult.tools_executed?.length || 0} Tools Called)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Strictly Enforced Schema Validations</span>
                </div>

                <div className="space-y-3">
                  {agentAuditResult.tools_executed?.map((t: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">TOOL #{idx + 1}: {t.tool_name}</span>
                        <span className="text-[10px] text-slate-500">Status: 200 OK</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <strong>Inputs:</strong> {JSON.stringify(t.inputs || {})}
                      </div>
                      <div className="text-[11px] text-slate-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-48 scrollbar-thin">
                        <pre>{JSON.stringify(t, null, 2)}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Incident Detail Drawer */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadInsights();
          if (selectedIncident) {
            handleInspect(selectedIncident.id);
          }
        }}
      />
    </div>
  );
};
