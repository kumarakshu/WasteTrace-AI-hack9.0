import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, ClipboardList, MapPin,
  Repeat, CheckCircle2, Sparkles, BarChart3, Settings, Truck
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Overview Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/report', label: 'Report Incident', icon: <PlusCircle className="w-4 h-4" /> },
    { to: '/incidents', label: 'Incident Explorer', icon: <ClipboardList className="w-4 h-4" /> },
    { to: '/map', label: 'Hotspot Map', icon: <MapPin className="w-4 h-4" /> },
    { to: '/recurrence', label: 'Recurring Failures', icon: <Repeat className="w-4 h-4" />, badge: 'Core' },
    { to: '/dispatch', label: 'Smart Dispatch', icon: <Truck className="w-4 h-4" />, badge: 'Priority' },
    { to: '/resolutions', label: 'Resolution Tracking', icon: <CheckCircle2 className="w-4 h-4" /> },
    { to: '/insights', label: 'AI Insights', icon: <Sparkles className="w-4 h-4" />, badge: 'Smart' },
    { to: '/analytics', label: 'Analytics & Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { to: '/settings', label: 'Settings / Demo', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      <div className="p-4 border-b border-slate-800">
        <div className="text-xs uppercase font-semibold tracking-wider text-slate-400">
          Environmental Operations
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`
            }
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Recurrence Mission Box */}
      <div className="p-4 m-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
          <Repeat className="w-3.5 h-3.5" />
          <span>Core Principle</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed italic">
          "Don't just close complaints. Verify that the problem stays solved."
        </p>
      </div>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 text-center">
        WasteTrace AI v1.0 • Civic Intelligence
      </div>
    </aside>
  );
};

