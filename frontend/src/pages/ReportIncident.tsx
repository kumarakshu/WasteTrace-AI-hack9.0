import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createIncident, uploadImage, analyzeImage, fetchLocations } from '../services/api';
import { AIImageAnalysis, LocationItem, Incident } from '../types';
import {
  MAP_CONFIG,
  searchDelhiAddress,
  reverseGeocodeCoords,
  DelhiLandmark
} from '../config/mapConfig';
import {
  UploadCloud, MapPin, Sparkles, AlertCircle, CheckCircle2,
  Navigation, Eye, ShieldCheck, ArrowRight, Repeat, AlertTriangle,
  Search, RefreshCw, Compass
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default marker icon in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORIES = [
  'Overflowing garbage bin',
  'Missed garbage collection',
  'Illegal dumping',
  'Roadside garbage accumulation',
  'Construction waste',
  'Drain blockage caused by waste',
  'Other waste-related issue',
];

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

function MapClickHandler({
  onLocationSelect
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e: any) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({
  coords
}: {
  coords: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(coords, map.getZoom() > 14 ? map.getZoom() : 15, { duration: 1.0 });
  }, [coords, map]);
  return null;
}

export const ReportIncident: React.FC = () => {
  const navigate = useNavigate();

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [addressText, setAddressText] = useState('Vikas Marg, Laxmi Nagar, East Delhi 110092');
  const [coords, setCoords] = useState<[number, number]>(MAP_CONFIG.defaultCenter);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | undefined>(undefined);

  // Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ displayName: string; latitude: number; longitude: number; source: string }>>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [geocodingSource, setGeocodingSource] = useState<string | null>(null);

  // Photo & AI states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIImageAnalysis | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    fetchLocations().then(setLocations).catch(console.error);
  }, []);

  // Update pin and auto-reverse geocode address
  const handleMapLocationSelect = async (lat: number, lng: number) => {
    setCoords([lat, lng]);
    setSelectedLocationId(undefined); // Custom user point
    try {
      const geo = await reverseGeocodeCoords(lat, lng);
      setAddressText(geo.address);
      setGeocodingSource(geo.source);
    } catch {
      setAddressText(`Near ${lat.toFixed(4)}, ${lng.toFixed(4)}, East Delhi`);
      setGeocodingSource(null);
    }
  };

  // Preset location handler
  const handlePresetLocationChange = (locIdStr: string) => {
    if (!locIdStr) {
      setSelectedLocationId(undefined);
      return;
    }
    const locId = parseInt(locIdStr);
    const loc = locations.find((l) => l.id === locId);
    if (loc) {
      setSelectedLocationId(loc.id);
      setCoords([loc.latitude, loc.longitude]);
      setAddressText(loc.address);
      setGeocodingSource('Registered Municipal Monitoring Site');
      if (!title) {
        setTitle(`Waste report near ${loc.name.replace('[Demo] ', '')}`);
      }
    }
  };

  // Address search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingAddress(true);
      try {
        const results = await searchDelhiAddress(searchQuery);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (e) {
        console.error(e);
      } finally {
        setSearchingAddress(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (result: { displayName: string; latitude: number; longitude: number; source: string }) => {
    setCoords([result.latitude, result.longitude]);
    setAddressText(result.displayName);
    setGeocodingSource(result.source);
    setShowSearchResults(false);
    setSearchQuery('');
    if (!title) {
      setTitle(`Waste incident near ${result.displayName.split(',')[0]}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (.jpg, .jpeg, .png, .webp).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 5MB limit.');
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAiAnalysis(null);
  };

  const handleAIAnalyze = async () => {
    if (!selectedFile) return;
    try {
      setAnalyzingImage(true);
      setErrorMsg(null);
      const res = await analyzeImage(selectedFile);
      setAiAnalysis(res);
      if (res.suggested_category && CATEGORIES.includes(res.suggested_category)) {
        setCategory(res.suggested_category);
      }
      if (res.severity_estimate && ['Low', 'Medium', 'High', 'Critical'].includes(res.severity_estimate)) {
        setSeverity(res.severity_estimate as any);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI vision analysis was unable to process this image.');
    } finally {
      setAnalyzingImage(false);
    }
  };

  // Explicit GPS trigger
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Please select directly on the map.');
      return;
    }
    setGeoLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords([lat, lng]);
        setGeoLocating(false);
        try {
          const geo = await reverseGeocodeCoords(lat, lng);
          setAddressText(geo.address);
          setGeocodingSource('Browser GPS + ' + geo.source);
        } catch {
          setAddressText(`GPS Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      },
      (err) => {
        let msg = 'Location request failed. Please click your location on the map.';
        if (err.code === 1) msg = 'Location permission denied. Map pin preserved at current Delhi location.';
        else if (err.code === 2) msg = 'GPS position unavailable. Map selection is active.';
        else if (err.code === 3) msg = 'GPS request timed out. Map selection is active.';
        setGeoError(msg);
        setGeoLocating(false);
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);

      let uploadedUrl: string | undefined = undefined;
      if (selectedFile) {
        const upRes = await uploadImage(selectedFile);
        uploadedUrl = upRes.url;
      }

      const newInc = await createIncident({
        title,
        category,
        description,
        severity,
        latitude: coords[0],
        longitude: coords[1],
        address_text: addressText || `Near ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}, East Delhi`,
        is_anonymous: isAnonymous,
        location_id: selectedLocationId,
        image_url: uploadedUrl,
      });

      setCreatedIncident(newInc);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit incident report');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdIncident) {
    return (
      <div className="max-w-xl mx-auto my-8 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Incident Registered & Evaluated!</h2>
        
        {createdIncident.is_recurring ? (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-center gap-2">
            <Repeat className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Spatial Recurrence Engine Triggered:</strong> {createdIncident.recurrence_count} prior compatible incident(s) detected within 50m of this location.
            </span>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
            No historical recurrence detected within the 50m radius. Initial isolated incident record established.
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-xl text-left text-xs space-y-1.5 border border-slate-200 font-mono">
          <div><strong>Incident ID:</strong> {createdIncident.id}</div>
          <div><strong>Location:</strong> {createdIncident.address_text}</div>
          <div><strong>Coordinates:</strong> {createdIncident.latitude.toFixed(4)}, {createdIncident.longitude.toFixed(4)}</div>
          <div><strong>Category:</strong> {createdIncident.category}</div>
          <div><strong>Severity:</strong> {createdIncident.severity}</div>
          <div><strong>Priority Score:</strong> {createdIncident.priority_score.toFixed(1)} / 100 ({createdIncident.priority_level})</div>
          <div><strong>Status:</strong> {createdIncident.status}</div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              setCreatedIncident(null);
              setTitle('');
              setDescription('');
              setSelectedFile(null);
              setPreviewUrl(null);
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Submit Another Report
          </button>
          <Link
            to={`/incidents?highlight=${createdIncident.id}`}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Track in Incident Explorer</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" />
            <span>East Delhi Operations MVP</span>
          </span>
          <span className="text-xs text-slate-400 font-mono">Laxmi Nagar • Nirman Vihar • Preet Vihar</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Citizen Waste Incident Report</h1>
        <p className="text-xs text-slate-500 mt-1">
          Report municipal cleanliness, overflowing bins, drainage chokes, or illegal dumping across East Delhi localities.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form Details (2 cols) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Incident Details</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Overflowing garbage bin outside Vikas Marg Metro exit"
                required
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white font-medium"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reported Severity *</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white font-medium"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s} Severity
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description *</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe volume of waste, foul odor, pedestrian obstruction, or drain blockage..."
                required
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white"
              />
            </div>

            {/* Demonstration Site Preset Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Preset Demonstration Site (East Delhi)</span>
                <span className="text-[10px] text-emerald-700 font-normal">Auto-snaps to monitored real locations</span>
              </label>
              <select
                value={selectedLocationId || ''}
                onChange={(e) => handlePresetLocationChange(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-emerald-50/40 text-slate-800 font-medium"
              >
                <option value="">-- Choose a Monitored Delhi Location (or click map) --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name.replace('[Demo] ', '')} ({loc.zone})
                  </option>
                ))}
              </select>
            </div>

            {/* Address Search Bar */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Search Delhi Locality or Landmark</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type 'Laxmi Nagar', 'Nirman Vihar', 'Preet Vihar', 'Shakarpur'..."
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white"
                />
                {searchingAddress && (
                  <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-3 text-emerald-600 animate-spin" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left p-2.5 text-xs hover:bg-emerald-50/80 transition-colors flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-800">{res.displayName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {res.latitude.toFixed(4)}, {res.longitude.toFixed(4)} • {res.source}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Selected Street Address / Landmark *</span>
                {geocodingSource && (
                  <span className="text-[10px] font-mono text-slate-400">Source: {geocodingSource}</span>
                )}
              </label>
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="e.g. Opposite Vikas Marg Metro Pillar 104, Preet Vihar"
                required
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500 bg-white"
              />
            </div>

            {/* Coordinates & Geolocation */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Geographic Coordinates (WGS84)</span>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={geoLocating}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                >
                  <Navigation className={`w-3 h-3 ${geoLocating ? 'animate-spin' : ''}`} />
                  <span>{geoLocating ? 'Acquiring GPS...' : 'Use My GPS Location'}</span>
                </button>
              </div>
              {geoError && <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">{geoError}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={coords[0]}
                    onChange={(e) => setCoords([parseFloat(e.target.value) || 0, coords[1]])}
                    className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={coords[1]}
                    onChange={(e) => setCoords([coords[0], parseFloat(e.target.value) || 0])}
                    className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="anon"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="anon" className="text-xs text-slate-600 cursor-pointer">
                Submit anonymously (public identity withheld from municipal records)
              </label>
            </div>
          </div>

          {/* Right Column: Photo Upload, AI Vision & Delhi Map (1 col) */}
          <div className="space-y-4">
            {/* Interactive Delhi Map Coordinate Picker */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Click Map to Set Location
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  East Delhi
                </span>
              </div>

              {tileError && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  Map tile server slow or offline. Direct coordinate entry remains fully functional.
                </div>
              )}

              <div className="h-56 w-full rounded-xl overflow-hidden border border-slate-200 relative">
                <MapContainer
                  center={coords}
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
                  <Marker position={coords} />
                  <MapClickHandler onLocationSelect={handleMapLocationSelect} />
                  <MapController coords={coords} />
                </MapContainer>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Click any street to position pin</span>
                <span className="font-mono">{coords[0].toFixed(4)}, {coords[1].toFixed(4)}</span>
              </div>
            </div>

            {/* Photo Evidence & AI Vision */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Photo Evidence</h3>

              <div>
                <label className="block border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500 transition-colors bg-slate-50/50">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                  <span className="text-xs font-semibold text-slate-700 block">Upload Incident Photo</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">JPG, PNG, WebP up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {previewUrl && (
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-40 flex items-center justify-center">
                    <img src={previewUrl} alt="Preview" className="object-contain max-h-40 w-full" />
                  </div>

                  <button
                    type="button"
                    onClick={handleAIAnalyze}
                    disabled={analyzingImage}
                    className="w-full py-2 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${analyzingImage ? 'animate-spin' : ''}`} />
                    <span>{analyzingImage ? 'Analyzing with AI Vision...' : 'AI Category Assistant'}</span>
                  </button>
                </div>
              )}

              {aiAnalysis && (
                <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>AI Suggestion</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-200 font-bold">
                      {(aiAnalysis.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-indigo-900">{aiAnalysis.suggested_category}</div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">{aiAnalysis.observation_summary}</div>
                  </div>
                  <div className="text-[10px] text-indigo-500 italic pt-1 border-t border-indigo-200/60">
                    Source: {aiAnalysis.provider}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/incidents')}
            className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs flex items-center gap-2"
          >
            <span>{submitting ? 'Registering Incident...' : 'Submit Incident Report'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
