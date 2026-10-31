import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import { UserRole } from '../types';
import { fetchHealth } from '../services/api';
import {
  Recycle, AlertCircle, ShieldCheck, User, Wrench, Plus, CheckCircle
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { role, setRole } = useRole();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(() => setIsBackendHealthy(true))
      .catch(() => setIsBackendHealthy(false));
    const interval = setInterval(() => {
      fetchHealth()
        .then(() => setIsBackendHealthy(true))
        .catch(() => setIsBackendHealthy(false));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const roles: { name: UserRole; icon: React.ReactNode; desc: string }[] = [
    { name: 'Citizen', icon: <User className="w-3.5 h-3.5" />, desc: 'Submit reports & view public alerts' },
    { name: 'Field Worker', icon: <Wrench className="w-3.5 h-3.5" />, desc: 'View assigned & submit cleanup evidence' },
    { name: 'Supervisor', icon: <ShieldCheck className="w-3.5 h-3.5" />, desc: 'Full triage, dispatch & verify resolution' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs group-hover:bg-emerald-800 transition-colors">
                <Recycle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight text-slate-900">WasteTrace</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    AI
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Detect recurrence. Prioritize action. Verify resolution.
                </p>
              </div>
            </Link>
          </div>

          {/* Right Side: Demo Mode, Role Switcher, Health & Action */}
          <div className="flex items-center gap-3">
            {/* System Health */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              <span className="text-slate-600">
                {isBackendHealthy ? 'API Active' : 'Connecting...'}
              </span>
            </div>

            {/* Role Switcher Pill */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 px-2 hidden lg:inline">Demo Role:</span>
              <div className="flex gap-1">
                {roles.map((r) => {
                  const isActive = role === r.name;
                  return (
                    <button
                      key={r.name}
                      onClick={() => setRole(r.name)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                      title={r.desc}
                    >
                      {r.icon}
                      <span className="hidden sm:inline">{r.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Report CTA */}
            <Link
              to="/report"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Report</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

