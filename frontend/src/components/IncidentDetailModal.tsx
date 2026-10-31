import React, { useState } from 'react';
import { Incident } from '../types';
import { useRole } from '../context/RoleContext';
import { updateIncidentStatus, submitEvidence, verifyResolution, uploadImage } from '../services/api';
import {
  X, AlertTriangle, ShieldCheck, Clock, MapPin, Repeat,
  FileCheck2, ChevronRight, User, Sparkles, CheckCircle, XCircle
} from 'lucide-react';

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const IncidentDetailModal: React.FC<Props> = ({ incident, onClose, onRefresh }) => {
  const { role, isSupervisor, isFieldWorker } = useRole();
  const [activeTab, setActiveTab] = useState<'overview' | 'priority' | 'evidence' | 'history'>('overview');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Field Worker evidence submission form state
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);

  // Supervisor verification form state
  const [verifyNotes, setVerifyNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [assignedCrew, setAssignedCrew] = useState('Sanitation Crew Beta');

  if (!incident) return null;

  const breakdown = incident.priority_breakdown;

  const handleStatusChange = async (newStatus: string) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await updateIncidentStatus(incident.id, {
        to_status: newStatus,
        role: role,
        assigned_to: newStatus === 'Assigned' ? assignedCrew : undefined,
      });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      let imgUrl = '';
      if (evidenceFile) {
        const uploadRes = await uploadImage(evidenceFile);
        imgUrl = uploadRes.url;
      }
      await submitEvidence(incident.id, {
        role: role,
        notes: evidenceNotes,
        image_url: imgUrl || undefined,
      });
      setEvidenceNotes('');
      setEvidenceFile(null);
      setEvidencePreview(null);
      onRefresh();
      setActiveTab('evidence');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit evidence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (approved: boolean) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await verifyResolution(incident.id, {
        approved,
        role: role,
        notes: verifyNotes,
        rejection_reason: approved ? undefined : rejectionReason,
      });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record verification');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                {incident.id}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                incident.severity === 'Critical' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                incident.severity === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                incident.severity === 'Medium' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                'bg-slate-100 text-slate-700 border border-slate-300'
              }`}>
                {incident.severity} Severity
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                incident.status === 'Resolved — Verified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                incident.status === 'Recurrence Detected' ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' :
                incident.status === 'Verification Pending' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {incident.status}
              </span>
              {incident.is_recurring && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                  <Repeat className="w-3 h-3" />
                  Recurring ({incident.recurrence_count}x)
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{incident.title}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {incident.address_text}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('priority')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'priority' ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Explainable Priority</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
              {incident.priority_score.toFixed(0)}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'evidence' ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Resolution Evidence</span>
            {incident.evidence && incident.evidence.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {incident.evidence.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history' ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Audit Log
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Description</h4>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  {incident.description}
                </p>
              </div>

              {/* Photo Evidence */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Attached Photo Evidence</h4>
                {incident.image_url ? (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-64 flex items-center justify-center">
                    <img
                      src={incident.image_url}
                      alt={incident.title}
                      className="object-contain max-h-64 w-full"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50">
                    No photographic evidence attached with initial report.
                  </div>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400">Category</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{incident.category}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400">Assigned To</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{incident.assigned_to || 'Unassigned'}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400">Reported At</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {new Date(incident.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400">Coordinates</div>
                  <div className="text-xs font-mono font-semibold text-slate-800 mt-0.5">
                    {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Supervisor Operational Assessment: Answering Core Questions */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-xs font-sans">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Supervisor Operational Diagnostic
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Grounded Municipal Decision Support</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">1. Problem Reported</span>
                    <span className="font-semibold text-slate-200">{incident.category}</span>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{incident.title}</p>
                  </div>

                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">2. Compatible Historical Cases</span>
                    <span className="font-semibold text-slate-200">{incident.recurrence_count} prior compatible complaint(s)</span>
                    <p className="text-[11px] text-slate-400">Within 50m spatial cluster radius</p>
                  </div>

                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">3. Recurrence After Resolution</span>
                    {incident.status === 'Recurrence Detected' ? (
                      <span className="font-bold text-rose-400">YES — Post-resolution relapse detected</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">None detected (or awaiting review)</span>
                    )}
                    <p className="text-[11px] text-slate-400">30-day follow-up tracking window</p>
                  </div>

                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">4. Priority Score Evidence</span>
                    <span className="font-semibold text-slate-200">
                      Score {incident.priority_score.toFixed(1)}/100 ({incident.severity} Sev, {incident.recurrence_count}x Rec)
                    </span>
                    <p className="text-[11px] text-slate-400">Safeguard: {incident.severity === 'Critical' ? 'Active (≥85 enforced)' : 'Standard weights'}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-100 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-300 block mb-0.5">5. Recommended Action for Supervisor:</span>
                    <span className="text-slate-200">
                      {incident.status === 'Verification Pending'
                        ? 'Inspect uploaded field worker before/after evidence photos in the Evidence tab, then mark Verified or Reject with feedback.'
                        : incident.status === 'Recurrence Detected'
                        ? 'Dispatch rapid secondary crew and inspect container volume. Recurring failure indicates collection frequency deficit.'
                        : incident.status === 'Reported'
                        ? 'Assign nearest sanitation field unit to assess on-site accumulation and establish evidence.'
                        : incident.status === 'Assigned'
                        ? 'Follow up with assigned field crew for completion timestamp and cleanup photo submission.'
                        : 'Maintain 30-day passive monitoring. Ticket is verified closed.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recurrence Warning Banner */}
              {incident.status === 'Recurrence Detected' && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Recurrence Detected After Previous Resolution!</span>
                  </div>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    This location experienced a previous waste event marked 'Resolved — Verified', but a new compatible incident was reported within the follow-up period. This indicates an underlying operational breakdown.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPLAINABLE PRIORITY */}
          {activeTab === 'priority' && breakdown && (
            <div className="space-y-6">
              {/* Score Gauge Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs uppercase font-semibold text-emerald-400">Explainable Priority Engine</span>
                    <h3 className="text-2xl font-bold">Priority Score: {breakdown.final_score} / 100</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    breakdown.priority_level === 'Critical' ? 'bg-rose-500 text-white' :
                    breakdown.priority_level === 'High' ? 'bg-amber-500 text-white' :
                    breakdown.priority_level === 'Medium' ? 'bg-blue-500 text-white' :
                    'bg-slate-600 text-white'
                  }`}>
                    {breakdown.priority_level} Priority
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      breakdown.final_score >= 80 ? 'bg-rose-500' :
                      breakdown.final_score >= 60 ? 'bg-amber-500' :
                      breakdown.final_score >= 40 ? 'bg-blue-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${breakdown.final_score}%` }}
                  />
                </div>

                {breakdown.urgent_safeguard_active && (
                  <div className="mt-3 text-xs bg-rose-950/80 border border-rose-500/50 p-2.5 rounded-lg text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span><strong>Urgent-Review Safeguard Active:</strong> Critical severity enforces guaranteed priority threshold (min 85).</span>
                  </div>
                )}
              </div>

              {/* Factor Breakdown Weights */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Transparent Component Breakdown</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">1. Severity (40%)</span>
                      <span className="font-mono font-bold text-slate-900">{breakdown.severity_score} / 100</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                      <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${breakdown.severity_score}%` }} />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">2. Recurrence Frequency (30%)</span>
                      <span className="font-mono font-bold text-slate-900">{breakdown.recurrence_score} / 100</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${breakdown.recurrence_score}%` }} />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">3. Unresolved Duration (20%)</span>
                      <span className="font-mono font-bold text-slate-900">{breakdown.duration_score} / 100</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{breakdown.duration_hours} hours elapsed</div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5">
                      <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${breakdown.duration_score}%` }} />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">4. Evidence Confidence (10%)</span>
                      <span className="font-mono font-bold text-slate-900">{breakdown.evidence_score} / 100</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{breakdown.evidence_label}</div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5">
                      <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${breakdown.evidence_score}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Recommendation */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Suggested Next Action</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {breakdown.suggested_next_action}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: RESOLUTION EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-6">
              {/* Existing Evidence List */}
              {incident.evidence && incident.evidence.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Submitted Verification Records</h4>
                  {incident.evidence.map((ev) => (
                    <div key={ev.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {ev.submitted_by_role}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(ev.cleanup_timestamp).toLocaleString()}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          ev.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ev.is_verified ? 'Verified Clean' : 'Pending Review'}
                        </span>
                      </div>

                      {ev.notes && (
                        <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                          {ev.notes}
                        </p>
                      )}

                      {ev.image_url && (
                        <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-48 flex items-center justify-center">
                          <img src={ev.image_url} alt="Evidence" className="object-contain max-h-48" />
                        </div>
                      )}

                      {ev.rejection_reason && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                          <strong>Rejection reason:</strong> {ev.rejection_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50">
                  No cleanup evidence has been submitted yet.
                </div>
              )}

              {/* Field Worker: Submit Cleanup Evidence Form */}
              {(isFieldWorker || isSupervisor) && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Submit New Cleanup Evidence ({role})</span>
                  </h4>
                  <form onSubmit={handleSubmitEvidence} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Crew Cleanup Notes</label>
                      <textarea
                        rows={2}
                        value={evidenceNotes}
                        onChange={(e) => setEvidenceNotes(e.target.value)}
                        placeholder="Detail the cleanup actions performed, bin wash, or collected weight..."
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-emerald-500 bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Post-Cleanup Photo</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setEvidenceFile(file);
                            setEvidencePreview(URL.createObjectURL(file));
                          }
                        }}
                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                    </div>
                    {evidencePreview && (
                      <div className="max-h-36 rounded-lg overflow-hidden border border-slate-200">
                        <img src={evidencePreview} alt="Preview" className="object-contain max-h-36" />
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
                    >
                      {submitting ? 'Uploading...' : 'Submit Evidence for Verification'}
                    </button>
                  </form>
                </div>
              )}

              {/* Supervisor: Review & Verify Resolution */}
              {isSupervisor && incident.status === 'Verification Pending' && (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Supervisor Verification Audit</span>
                  </h4>
                  <p className="text-xs text-indigo-700">
                    Verify that photographic evidence matches the location and that all waste has been cleared before closing.
                  </p>
                  <div>
                    <input
                      type="text"
                      placeholder="Supervisor audit notes (optional)"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white mb-2"
                    />
                    <input
                      type="text"
                      placeholder="Rejection reason (if rejecting)"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(true)}
                      disabled={submitting}
                      className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve & Verify Resolution</span>
                    </button>
                    <button
                      onClick={() => handleVerify(false)}
                      disabled={submitting}
                      className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject & Reopen Incident</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT LOG */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Append-Only Audit Trail</h4>
              {incident.history && incident.history.length > 0 ? (
                <div className="space-y-3 relative pl-6 border-l-2 border-slate-200">
                  {incident.history.map((h, i) => (
                    <div key={h.id || i} className="relative">
                      <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-white" />
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-semibold text-slate-800">
                            {h.from_status} → <span className="text-emerald-700 font-bold">{h.to_status}</span>
                          </span>
                          <span>{new Date(h.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-600">
                          Changed by: <strong>{h.changed_by_role}</strong>
                        </div>
                        {h.notes && (
                          <div className="text-slate-700 italic pt-1 border-t border-slate-200 mt-1">
                            "{h.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No audit records found.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions based on role */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            Active Role: <strong className="text-slate-800">{role}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSupervisor && ['Reported', 'Recurrence Detected', 'Reopened'].includes(incident.status) && (
              <button
                onClick={() => handleStatusChange('Assigned')}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
              >
                Assign Sanitation Crew
              </button>
            )}

            {isFieldWorker && incident.status === 'Assigned' && (
              <button
                onClick={() => handleStatusChange('Cleanup Submitted')}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
              >
                Mark Cleanup Submitted
              </button>
            )}

            {(isFieldWorker || isSupervisor) && incident.status === 'Cleanup Submitted' && activeTab !== 'evidence' && (
              <button
                onClick={() => setActiveTab('evidence')}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Upload Photo Evidence
              </button>
            )}

            {isSupervisor && incident.status === 'Verification Pending' && activeTab !== 'evidence' && (
              <button
                onClick={() => setActiveTab('evidence')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
              >
                Audit Evidence Now
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

