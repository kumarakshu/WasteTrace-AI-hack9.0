import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from './context/RoleContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';

import { Dashboard } from './pages/Dashboard';
import { ReportIncident } from './pages/ReportIncident';
import { IncidentExplorer } from './pages/IncidentExplorer';
import { HotspotMap } from './pages/HotspotMap';
import { RecurringFailures } from './pages/RecurringFailures';
import { ResolutionTracking } from './pages/ResolutionTracking';
import { SmartDispatchQueue } from './pages/SmartDispatchQueue';
import { AIInsights } from './pages/AIInsights';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900">
          <Navbar />
          <div className="flex-1 flex overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/report" element={<ReportIncident />} />
                  <Route path="/incidents" element={<IncidentExplorer />} />
                  <Route path="/map" element={<HotspotMap />} />
                  <Route path="/recurrence" element={<RecurringFailures />} />
                  <Route path="/dispatch" element={<SmartDispatchQueue />} />
                  <Route path="/resolutions" element={<ResolutionTracking />} />
                  <Route path="/insights" element={<AIInsights />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </RoleProvider>
  );
}

export default App;
