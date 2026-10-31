import {
  Incident, DashboardSummary, LocationItem, HotspotPoint,
  RecurrenceAlert, AIInsight, AIImageAnalysis, SystemSettings,
  DispatchQueueResponse, DispatchQueueItem, DispatchAssignmentRequest,
  RootCauseAnalysisResponse, HotspotInvestigationResponse
} from '../types';

const API_BASE = '/api/v1';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/dashboard/summary`);
  if (!res.ok) throw new Error('Failed to load dashboard summary');
  return res.json();
}

export async function fetchIncidents(params: {
  category?: string;
  severity?: string;
  status?: string;
  location_id?: number;
  is_recurring?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}): Promise<{ total: number; page: number; page_size: number; items: Incident[] }> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.severity) query.append('severity', params.severity);
  if (params.status) query.append('status', params.status);
  if (params.location_id) query.append('location_id', params.location_id.toString());
  if (params.is_recurring !== undefined) query.append('is_recurring', params.is_recurring.toString());
  if (params.search) query.append('search', params.search);
  if (params.sort_by) query.append('sort_by', params.sort_by);
  if (params.sort_order) query.append('sort_order', params.sort_order);
  if (params.page) query.append('page', params.page.toString());
  if (params.page_size) query.append('page_size', params.page_size.toString());

  const res = await fetch(`${API_BASE}/incidents?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncident(id: string): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}`);
  if (!res.ok) throw new Error(`Failed to load incident ${id}`);
  return res.json();
}

export async function createIncident(data: {
  title: string;
  category: string;
  description: string;
  severity: string;
  latitude: number;
  longitude: number;
  address_text: string;
  is_anonymous: boolean;
  location_id?: number;
  image_url?: string;
}): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to submit incident');
  }
  return res.json();
}

export async function updateIncidentStatus(id: string, data: {
  to_status: string;
  role: string;
  notes?: string;
  assigned_to?: string;
}): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function submitEvidence(id: string, data: {
  role: string;
  notes?: string;
  image_url?: string;
}): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to submit cleanup evidence');
  return res.json();
}

export async function verifyResolution(id: string, data: {
  approved: boolean;
  role: string;
  notes?: string;
  rejection_reason?: string;
}): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to record verification');
  return res.json();
}

export async function fetchLocations(): Promise<LocationItem[]> {
  const res = await fetch(`${API_BASE}/locations`);
  if (!res.ok) throw new Error('Failed to fetch locations');
  return res.json();
}

export async function fetchHotspots(): Promise<HotspotPoint[]> {
  const res = await fetch(`${API_BASE}/hotspots`);
  if (!res.ok) throw new Error('Failed to fetch hotspots');
  return res.json();
}

export async function fetchRecurrenceAlerts(): Promise<RecurrenceAlert[]> {
  const res = await fetch(`${API_BASE}/recurrence-alerts`);
  if (!res.ok) throw new Error('Failed to fetch recurrence alerts');
  return res.json();
}

export async function fetchAIInsights(): Promise<AIInsight[]> {
  const res = await fetch(`${API_BASE}/ai/insights`);
  if (!res.ok) throw new Error('Failed to fetch insights');
  return res.json();
}

export async function analyzeImage(file: File): Promise<AIImageAnalysis> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/ai/analyze-image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Image analysis failed');
  }
  return res.json();
}

export async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Upload failed');
  }
  return res.json();
}

export async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(data: SystemSettings): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function reseedDemoData(): Promise<{ status: string; message: string; incident_count: number }> {
  const res = await fetch(`${API_BASE}/demo/seed`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reseed database');
  return res.json();
}

export async function resetDemoData(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset database');
  return res.json();
}

export async function fetchAgentTools(): Promise<{ status: string; agent_name: string; description: string; tools: any[] }> {
  const res = await fetch(`${API_BASE}/agent/tools`);
  if (!res.ok) throw new Error('Failed to fetch agent tools');
  return res.json();
}

export async function runAgentAudit(auditType: string, targetId?: string): Promise<{
  status: string;
  audit_type: string;
  generated_at: string;
  tools_executed: any[];
  findings: any;
}> {
  const res = await fetch(`${API_BASE}/agent/run-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audit_type: auditType, target_id: targetId }),
  });
  if (!res.ok) throw new Error('Failed to run agent operational audit');
  return res.json();
}

export async function fetchDispatchQueue(params?: {
  status?: string;
  priority_level?: string;
  zone?: string;
  unassigned_only?: boolean;
}): Promise<DispatchQueueResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.priority_level) query.append('priority_level', params.priority_level);
  if (params?.zone) query.append('zone', params.zone);
  if (params?.unassigned_only) query.append('unassigned_only', 'true');

  const res = await fetch(`${API_BASE}/dispatch/queue?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch dispatch queue');
  return res.json();
}

export async function assignDispatchWorker(data: DispatchAssignmentRequest): Promise<DispatchQueueItem> {
  const res = await fetch(`${API_BASE}/dispatch/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to assign field crew');
  }
  return res.json();
}

export async function fetchRootCauseAnalysis(locationId: number): Promise<RootCauseAnalysisResponse> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/root-cause`);
  if (!res.ok) throw new Error(`Failed to fetch root cause analysis for location ${locationId}`);
  return res.json();
}

export async function fetchHotspotInvestigation(locationId: number): Promise<HotspotInvestigationResponse> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/investigation`);
  if (!res.ok) throw new Error(`Failed to fetch investigation data for location ${locationId}`);
  return res.json();
}


