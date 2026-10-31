import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings, reseedDemoData, resetDemoData, fetchHealth } from '../services/api';
import { SystemSettings } from '../types';
import {
  Settings as SettingsIcon, RefreshCw, Trash2, CheckCircle2,
  Sliders, ShieldAlert, Database, Info, Save
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    recurrence_radius_meters: 50.0,
    recurrence_window_days: 14,
    follow_up_window_days: 30,
    weight_severity: 0.40,
    weight_recurrence: 0.30,
    weight_duration: 0.20,
    weight_evidence: 0.10,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reseeding, setReseeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchHealth()])
      .then(([s, h]) => {
        setSettings(s);
        setHealthInfo(h);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg(null);
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSuccessMsg('System configuration and algorithmic parameters updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReseed = async () => {
    try {
      setReseeding(true);
      const res = await reseedDemoData();
      setSuccessMsg(`Reseeded: ${res.message}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reseed');
    } finally {
      setReseeding(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to clear all incidents and locations?')) return;
    try {
      setResetting(true);
      await resetDemoData();
      setSuccessMsg('Database cleared of all demonstration records.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reset database');
    } finally {
      setResetting(false);
    }
  };

  const totalWeights = (
    settings.weight_severity +
    settings.weight_recurrence +
    settings.weight_duration +
    settings.weight_evidence
  ).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Demo Controls</h1>
        <p className="text-xs text-slate-500 mt-1">
          Tune recurrence detection thresholds, inspect priority scoring weights, and manage demo datasets.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Demo Dataset Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-900">Demonstration Dataset Management</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The demo dataset includes realistic synthetic incidents representing overflowing bins, chronic illegal dumping, and post-cleanup recurrence across diverse urban sectors.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleReseed}
            disabled={reseeding}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reseeding ? 'animate-spin' : ''}`} />
            <span>{reseeding ? 'Reseeding...' : 'Reset & Reseed Demo Data (25 Incidents)'}</span>
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{resetting ? 'Clearing...' : 'Clear All Records'}</span>
          </button>
        </div>
      </div>

      {/* Algorithmic Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">Recurrence Detection Parameters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Proximity Radius (meters)</label>
              <input
                type="number"
                min="10"
                max="500"
                value={settings.recurrence_radius_meters}
                onChange={(e) =>
                  setSettings({ ...settings, recurrence_radius_meters: parseFloat(e.target.value) || 50 })
                }
                className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block">Default: 50.0m radius</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Time Window (days)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.recurrence_window_days}
                onChange={(e) =>
                  setSettings({ ...settings, recurrence_window_days: parseInt(e.target.value) || 14 })
                }
                className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block">Default: 14 days</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Follow-up Window (days)</label>
              <input
                type="number"
                min="7"
                max="180"
                value={settings.follow_up_window_days}
                onChange={(e) =>
                  setSettings({ ...settings, follow_up_window_days: parseInt(e.target.value) || 30 })
                }
                className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
              />
              <span className="text-[10px] text-slate-500 block">Post-resolution monitoring window (30 days)</span>
            </div>
          </div>
        </div>

        {/* Priority Weights */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Explainable Priority Scoring Weights</h3>
            </div>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              totalWeights === '1.00' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              Sum: {totalWeights} (Target: 1.00)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="font-semibold text-slate-700 block">Severity (40%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.weight_severity}
                onChange={(e) => setSettings({ ...settings, weight_severity: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="font-semibold text-slate-700 block">Recurrence (30%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.weight_recurrence}
                onChange={(e) => setSettings({ ...settings, weight_recurrence: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="font-semibold text-slate-700 block">Duration (20%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.weight_duration}
                onChange={(e) => setSettings({ ...settings, weight_duration: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="font-semibold text-slate-700 block">Evidence (10%)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.weight_evidence}
                onChange={(e) => setSettings({ ...settings, weight_evidence: parseFloat(e.target.value) || 0 })}
                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Parameters'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* System Diagnostic Information */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 space-y-1 font-mono">
        <div>Platform: WasteTrace AI v1.0.0</div>
        <div>Database: SQLite zero-configuration local engine (PostgreSQL compatible)</div>
        <div>Environment: {healthInfo?.environment || 'development'}</div>
        <div>AI Vision Integration: {healthInfo?.gemini_api_configured ? 'Google Gemini Live API active' : 'Offline Rule-Based Heuristic Fallback active'}</div>
      </div>
    </div>
  );
};

