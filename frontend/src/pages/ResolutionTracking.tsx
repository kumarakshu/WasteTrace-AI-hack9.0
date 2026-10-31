import React, { useState, useEffect } from 'react';
import { fetchIncidents, verifyResolution } from '../services/api';
import { Incident } from '../types';
import { useRole } from '../context/RoleContext';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import {
  CheckCircle2, ShieldCheck, AlertTriangle, Clock, Eye,
  RotateCcw, FileText, ChevronRight, XCircle
} from 'lucide-react';

export const ResolutionTracking: React.FC = () => {
  const { role, isSupervisor } = useRole();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [activeTab, setActiveTab] = useState<'verification_pending' | 'cleanup_submitted' | 'verified' | 'relapsed' | 'all'>('verification_pending');

  const [verifyNotes, setVerifyNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actingIncidentId, setActingIncidentId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchIncidents({ page: 1, page_size: 50 });
      setIncidents(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerify = async (incId: string, approved: boolean) => {
    try {
      setActingIncidentId(incId);
      await verifyResolution(incId, {
        approved,
        role,
        notes: verifyNotes || undefined,
        rejection_reason: approved ? undefined : (rejectionReason || 'Site still shows waste accumulation'),
      });
      setVerifyNotes('');
      setRejectionReason('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActingIncidentId(null);
    }
  };

  const verificationPendingIncidents = incidents.filter((i) => i.status === 'Verification Pending');
  const cleanupSubmittedIncidents = incidents.filter((i) => i.status === 'Cleanup Submitted');
  const verifiedIncidents = incidents.filter((i) => i.status === 'Resolved — Verified');
  const relapsedIncidents = incidents.filter((i) => i.status === 'Recurrence Detected' || i.status === 'Reopened');

  const displayList =
    activeTab === 'verification_pending' ? verificationPendingIncidents :
    activeTab === 'cleanup_submitted' ? cleanupSubmittedIncidents :
    activeTab === 'verified' ? verifiedIncidents :
    activeTab === 'relapsed' ? relapsedIncidents :
    incidents;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Resolution Tracking & Audit</h1>
          <p className="text-xs text-slate-500 mt-1">
            Distinguish submitted cleanup claims from verified evidence. Audit before-and-after photographic proof.
          </p>
        </div>

        {/* Status Pipeline Counter */}
        <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
          <span className="text-slate-500">Evidence Audit:</span>
          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
            {verificationPendingIncidents.length}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">Claimed Cleanup:</span>
          <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
            {cleanupSubmittedIncidents.length}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">Verified:</span>
          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            {verifiedIncidents.length}
          </span>
        </div>
      </div>

      {/* Principle Banner */}
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Resolution Lifecycle Protocol:</strong> A cleanup report is only closed after evidence is verified by a supervisor. Closing an incident never erases its history.
          </span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 self-start sm:self-auto shrink-0">
          Role: {role}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('verification_pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'verification_pending'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Evidence Review Pending ({verificationPendingIncidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('cleanup_submitted')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'cleanup_submitted'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Cleanup Submitted ({cleanupSubmittedIncidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('verified')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'verified'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Verified Resolved ({verifiedIncidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('relapsed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'relapsed'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Recurrence / Reopened ({relapsedIncidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({incidents.length})
        </button>
      </div>

      {/* Incidents Verification Cards */}
      <div className="space-y-4">
        {displayList.length > 0 ? (
          displayList.map((inc) => {
            const hasEvidence = inc.evidence && inc.evidence.length > 0;
            const latestEvidence = hasEvidence ? inc.evidence![0] : null;

            return (
              <div
                key={inc.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4"
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {inc.id}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{inc.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      inc.status === 'Resolved — Verified' ? 'bg-emerald-100 text-emerald-800' :
                      inc.status === 'Verification Pending' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Reported: {new Date(inc.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-medium text-slate-700">Location:</span> {inc.address_text} •{' '}
                  <span className="font-medium text-slate-700">Category:</span> {inc.category}
                </div>

                {/* Evidence Comparison Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Initial Citizen Report Photo
                    </div>
                    {inc.image_url ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-36 flex items-center justify-center">
                        <img src={inc.image_url} alt="Before" className="object-contain h-full w-full" />
                      </div>
                    ) : (
                      <div className="h-36 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 bg-slate-50">
                        No initial image provided
                      </div>
                    )}
                  </div>

                  {/* After */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Field Worker Cleanup Evidence
                    </div>
                    {latestEvidence && latestEvidence.image_url ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-36 flex items-center justify-center">
                        <img src={latestEvidence.image_url} alt="After" className="object-contain h-full w-full" />
                      </div>
                    ) : (
                      <div className="h-36 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 bg-slate-50">
                        No cleanup photo uploaded yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedIncident(inc)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Complete Incident Audit Trail</span>
                  </button>

                  {/* Supervisor Verification Actions */}
                  {isSupervisor && inc.status === 'Verification Pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVerify(inc.id, true)}
                        disabled={actingIncidentId === inc.id}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify & Mark Resolved</span>
                      </button>
                      <button
                        onClick={() => handleVerify(inc.id, false)}
                        disabled={actingIncidentId === inc.id}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject & Reopen</span>
                      </button>
                    </div>
                  )}

                  {inc.status === 'Resolved — Verified' && (
                    <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Follow-up monitoring active (30 days)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No incidents found in this category.
          </div>
        )}
      </div>

      {/* Incident Detail Drawer */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadData();
          if (selectedIncident) {
            fetchIncidents({ page: 1, page_size: 100 }).then((res) => {
              const u = res.items.find((i) => i.id === selectedIncident.id);
              if (u) setSelectedIncident(u);
            });
          }
        }}
      />
    </div>
  );
};

