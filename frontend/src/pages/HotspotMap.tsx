import React, { useState, useEffect } from 'react';
import { fetchHotspots, fetchIncident } from '../services/api';
import { HotspotPoint, Incident } from '../types';
import { IncidentDetailModal } from '../components/IncidentDetailModal';
import { HotspotInvestigationModal } from '../components/HotspotInvestigationModal';
import { MAP_CONFIG } from '../config/mapConfig';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, AlertTriangle, Repeat, Search, Layers,
  Eye, CheckCircle2, RotateCcw, Filter, ShieldCheck,
  Compass, AlertCircle, Sparkles, ShieldAlert
} from 'lucide-react';

function createCustomIcon(severity: string, isRecurring: boolean, status: string) {
  let color = '#10b981'; // Low / Emerald
  if (severity === 'Critical') color = '#e11d48';
  else if (severity === 'High') color = '#f59e0b';
  else if (severity === 'Medium') color = '#3b82f6';

  const isVerified = status === 'Resolved — Verified';
  const isPostResolution = status === 'Recurrence Detected';

  let innerSymbol = '';
  let ringHtml = '';

  if (isPostResolution) {
    color = '#be123c'; // Dark rose
    ringHtml = `
      <span style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: rgba(225, 29, 72, 0.4); top: -8px; left: -8px; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <span style="position: absolute; width: 48px; height: 48px; border-radius: 50%; border: 1.5px solid rgba(225, 29, 72, 0.6); top: -14px; left: -14px;"></span>
    `;
    innerSymbol = '<span style="color: #fff; font-size: 10px; font-weight: bold; line-height: 1;">!</span>';
  } else if (isRecurring) {
    ringHtml = `<span style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background-color: rgba(245, 158, 11, 0.35); top: -7px; left: -7px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`;
    innerSymbol = '<span style="width: 6px; height: 6px; background-color: #fff; border-radius: 50%;"></span>';
  } else if (isVerified) {
    color = '#059669'; // Emerald
    innerSymbol = '<span style="color: #fff; font-size: 9px; font-weight: bold; line-height: 1;">✓</span>';
  }

  const html = `
    <div style="position: relative; width: 22px; height: 22px; background-color: ${color}; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
      ${ringHtml}
      ${innerSymbol}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-map-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
  });
}

function MapViewController({
  coords,
  zoom
}: {
  coords: [number, number] | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, zoom || 15, { duration: 1.2 });
    }
  }, [coords, zoom, map]);
  return null;
}

export const HotspotMap: React.FC = () => {
  const [hotspots, setHotspots] = useState<HotspotPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'open' | 'high_priority' | 'recurring' | 'post_resolution' | 'verified'
  >('all');
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [investigatingLocationId, setInvestigatingLocationId] = useState<number | null>(null);
  const [tileError, setTileError] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchHotspots()
      .then((data) => setHotspots(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInspect = async (id: string) => {
    try {
      const inc = await fetchIncident(id);
      setSelectedIncident(inc);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetMapView = () => {
    setSelectedCoords([MAP_CONFIG.defaultCenter[0], MAP_CONFIG.defaultCenter[1]]);
  };

  // Filter application
  const filteredHotspots = hotspots.filter((h) => {
    // 1. Text Search
    const term = search.toLowerCase();
    const matchesSearch =
      h.location_name.toLowerCase().includes(term) ||
      h.category.toLowerCase().includes(term) ||
      h.id.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    // 2. Category Filter
    if (filterType === 'open') {
      return h.status !== 'Resolved — Verified';
    }
    if (filterType === 'high_priority') {
      return h.priority_score >= 60;
    }
    if (filterType === 'recurring') {
      return h.is_recurring;
    }
    if (filterType === 'post_resolution') {
      return h.status === 'Recurrence Detected';
    }
    if (filterType === 'verified') {
      return h.status === 'Resolved — Verified';
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              <span>East Delhi Corridor</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">Laxmi Nagar • Nirman Vihar • Preet Vihar</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Interactive Hotspot Map</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time geospatial waste telemetry with pulsing recurrence alerts and explainable priority scores.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-700 ring-2 ring-rose-200 animate-pulse" />
            <span className="text-slate-700 font-medium">Post-Resolution Relapse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span className="text-slate-600">Critical (≥85)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-600">High (60-84)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-600">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span className="text-slate-600">Verified Cleaned</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Map Controls */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {[
            { id: 'all', label: 'All Incidents' },
            { id: 'open', label: 'Open Incidents' },
            { id: 'high_priority', label: 'High Priority (≥60)' },
            { id: 'recurring', label: 'Recurring Hotspots' },
            { id: 'post_resolution', label: 'Post-Resolution Relapse' },
            { id: 'verified', label: 'Verified Cleanups' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterType === tab.id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleResetMapView}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
          title="Reset map view to East Delhi center"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Map View</span>
        </button>
      </div>

      {/* Tile Server Error Banner */}
      {tileError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Map tile server slow or unreachable. Marker coordinates and inspector remain fully functional.</span>
          </div>
          <button
            onClick={() => setTileError(false)}
            className="text-xs font-bold text-amber-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Container: Synchronized List & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[72vh]">
        {/* Synchronized Side List (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden order-2 lg:order-1">
          <div className="p-3.5 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Delhi hotspot locations..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-emerald-500 bg-white"
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing {filteredHotspots.length} of {hotspots.length} sites
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                East Delhi MVP
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
            {filteredHotspots.length > 0 ? (
              filteredHotspots.map((point) => (
                <div
                  key={point.id}
                  onClick={() => setSelectedCoords([point.latitude, point.longitude])}
                  className="p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200 space-y-1"
                >
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-xs text-slate-900 leading-tight">
                      {point.location_name.replace('[Demo] ', '')}
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      point.status === 'Recurrence Detected' ? 'bg-rose-700 text-white' :
                      point.status === 'Resolved — Verified' ? 'bg-emerald-100 text-emerald-800' :
                      point.severity === 'Critical' ? 'bg-rose-100 text-rose-800' :
                      point.severity === 'High' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {point.status === 'Recurrence Detected' ? 'Relapsed' : point.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{point.category}</div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700">
                        Score: {point.priority_score.toFixed(0)}
                      </span>
                      {point.is_recurring && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 flex items-center gap-0.5">
                          <Repeat className="w-2.5 h-2.5" />
                          {point.recurrence_count}x
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspect(point.id);
                      }}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No incidents match current filter criteria.
              </div>
            )}
          </div>
        </div>

        {/* Leaflet Map (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-slate-200 shadow-2xs relative order-1 lg:order-2">
          <MapContainer
            center={MAP_CONFIG.defaultCenter}
            zoom={MAP_CONFIG.defaultZoom}
            minZoom={MAP_CONFIG.minZoom}
            maxZoom={MAP_CONFIG.maxZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution={MAP_CONFIG.tileLayerAttribution}
              url={MAP_CONFIG.tileLayerUrl}
              eventHandlers={{
                tileerror: () => setTileError(true)
              }}
            />
            <MapViewController coords={selectedCoords} />

            {filteredHotspots.map((h) => (
              <Marker
                key={h.id}
                position={[h.latitude, h.longitude]}
                icon={createCustomIcon(h.severity, h.is_recurring, h.status)}
              >
                <Popup>
                  <div className="p-1 space-y-2 text-xs min-w-[200px]">
                    <div className="font-bold text-slate-900 text-sm">
                      {h.location_name.replace('[Demo] ', '')}
                    </div>
                    <div className="text-slate-600">{h.category}</div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        h.severity === 'Critical' ? 'bg-rose-100 text-rose-800' :
                        h.severity === 'High' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {h.severity}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        Score: {h.priority_score.toFixed(0)}
                      </span>
                    </div>

                    {h.status === 'Recurrence Detected' && (
                      <div className="text-[11px] text-rose-700 font-bold bg-rose-50 p-1.5 rounded border border-rose-200 flex items-center gap-1">
                        <Repeat className="w-3.5 h-3.5 shrink-0" />
                        <span>Post-Resolution Relapse Detected!</span>
                      </div>
                    )}

                    {h.status === 'Resolved — Verified' && (
                      <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Verified Cleaned (Active Follow-up)</span>
                      </div>
                    )}

                    <div className="text-[10px] font-mono text-slate-400">
                      Coordinates: {h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                      {h.location_id && (
                        <button
                          onClick={() => setInvestigatingLocationId(h.location_id!)}
                          className="w-full py-1.5 text-center font-bold text-white bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-400 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Investigate Hotspot</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleInspect(h.id)}
                        className="w-full py-1.5 text-center font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                      >
                        Inspect Case Audit Trail
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
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

      {/* Incident Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onRefresh={() => {
          loadData();
          if (selectedIncident) {
            handleInspect(selectedIncident.id);
          }
        }}
      />
    </div>
  );
};
