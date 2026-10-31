export type UserRole = 'Citizen' | 'Field Worker' | 'Supervisor';

export interface PriorityBreakdown {
  final_score: number;
  priority_level: 'Low' | 'Medium' | 'High' | 'Critical';
  severity_score: number;
  severity_weight: number;
  recurrence_score: number;
  recurrence_weight: number;
  duration_score: number;
  duration_weight: number;
  duration_hours: number;
  evidence_score: number;
  evidence_weight: number;
  evidence_label: string;
  urgent_safeguard_active: boolean;
  factors_summary: string[];
  suggested_next_action: string;
}

export interface StatusHistoryItem {
  id: number;
  incident_id: string;
  from_status: string;
  to_status: string;
  changed_by_role: string;
  notes?: string;
  created_at: string;
}

export interface ResolutionEvidenceItem {
  id: number;
  incident_id: string;
  submitted_by_role: string;
  image_url?: string;
  notes?: string;
  cleanup_timestamp: string;
  is_verified: boolean;
  verified_by_role?: string;
  verified_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface Incident {
  id: string;
  location_id?: number;
  title: string;
  category: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  latitude: number;
  longitude: number;
  address_text: string;
  status: 'Reported' | 'Assigned' | 'Cleanup Submitted' | 'Verification Pending' | 'Resolved — Verified' | 'Recurrence Detected' | 'Reopened';
  is_anonymous: boolean;
  image_url?: string;
  image_analysis?: string;
  assigned_to?: string;
  priority_score: number;
  priority_level: 'Low' | 'Medium' | 'High' | 'Critical';
  priority_breakdown?: PriorityBreakdown;
  recurrence_count: number;
  is_recurring: boolean;
  is_demo?: boolean;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  history?: StatusHistoryItem[];
  evidence?: ResolutionEvidenceItem[];
}

export interface LocationItem {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  zone: string;
  is_demo?: boolean;
  active_incidents_count: number;
  recurrence_count: number;
  highest_severity: string;
  highest_priority_score: number;
}

export interface HotspotPoint {
  id: string;
  location_id?: number;
  location_name: string;
  latitude: number;
  longitude: number;
  incident_count: number;
  recurrence_count: number;
  severity: string;
  priority_score: number;
  priority_level: string;
  is_recurring: boolean;
  is_demo?: boolean;
  category: string;
  status: string;
  last_reported: string;
}

export interface RecurrenceAlert {
  id: number;
  location_id?: number;
  primary_incident_id: string;
  trigger_incident_id: string;
  category: string;
  distance_meters: number;
  incident_count: number;
  rule_triggered: string;
  explanation: string;
  is_post_resolution: boolean;
  created_at: string;
}

export interface DashboardSummary {
  total_incidents: number;
  open_incidents: number;
  recurring_locations: number;
  high_priority_incidents: number;
  verified_resolutions: number;
  recurrence_after_resolution: number;
  severity_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  resolution_rate_percent: number;
}

export interface AIInsight {
  id: string;
  title: string;
  type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  pattern: string;
  locations_affected: number;
  supporting_incidents: string[];
  why_it_matters: string;
  suggested_action: string;
  limitations_and_uncertainty: string;
}

export interface AIImageAnalysis {
  suggested_category: string;
  confidence: number;
  severity_estimate: string;
  detected_objects: string[];
  observation_summary: string;
  provider: string;
  is_fallback: boolean;
  notes?: string;
}

export interface SystemSettings {
  recurrence_radius_meters: number;
  recurrence_window_days: number;
  follow_up_window_days: number;
  weight_severity: number;
  weight_recurrence: number;
  weight_duration: number;
  weight_evidence: number;
}

export interface DispatchQueueItem {
  id: string;
  title: string;
  location_id?: number;
  location_name: string;
  zone: string;
  address_text: string;
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  priority_score: number;
  priority_level: 'Low' | 'Medium' | 'High' | 'Critical';
  recurrence_count: number;
  is_recurring: boolean;
  status: string;
  assigned_to?: string;
  recommended_action: string;
  created_at: string;
  latitude: number;
  longitude: number;
  is_demo?: boolean;
}

export interface DispatchQueueResponse {
  total: number;
  critical_count: number;
  high_count: number;
  unassigned_count: number;
  items: DispatchQueueItem[];
}

export interface DispatchAssignmentRequest {
  incident_id: string;
  assigned_to: string;
  role: string;
  notes?: string;
}

export interface VerifiedObservation {
  text: string;
  supporting_incidents: string[];
  metrics: Record<string, any>;
}

export interface PlausibleHypothesis {
  hypothesis: string;
  grounds: string;
  caveat: string;
}

export interface ExplainableRecommendation {
  id: string;
  action: string;
  rationale: string;
  supporting_incidents: string[];
  measurements: Record<string, any>;
  confidence: 'High' | 'Moderate' | 'Low';
  verification_needed: string;
}

export interface RootCauseAnalysisResponse {
  location_id: number;
  location_name: string;
  address: string;
  zone: string;
  coordinates: number[];
  total_incidents: number;
  open_incidents_count: number;
  verified_incidents_count: number;
  post_resolution_relapse_count: number;
  mean_time_to_relapse_days?: number | null;
  dominant_category: string;
  dominant_category_percentage: number;
  evidence_compliance_percentage: number;
  verified_observations: VerifiedObservation[];
  plausible_hypotheses: PlausibleHypothesis[];
  missing_information: string[];
  recommendations: ExplainableRecommendation[];
  generated_at: string;
}

export interface HotspotInvestigationResponse {
  location: LocationItem;
  timeline: Array<{
    timestamp?: string;
    event_type: string;
    incident_id?: string;
    title?: string;
    category?: string;
    severity?: string;
    priority_score?: number;
    details: string;
    changed_by?: string;
    rule?: string;
    is_demo?: boolean;
  }>;
  nearby_incidents: Array<{
    id: string;
    title: string;
    category: string;
    severity: string;
    status: string;
    is_recurring: boolean;
    created_at?: string;
    is_demo?: boolean;
  }>;
  cleanups: Array<{
    evidence_id: number;
    incident_id: string;
    image_url?: string;
    notes?: string;
    submitted_by_role: string;
    cleanup_timestamp?: string;
    is_verified: boolean;
    verified_by_role?: string;
    verified_at?: string;
    rejection_reason?: string;
  }>;
  post_resolution_relapses: Array<{
    alert_id: number;
    rule: string;
    distance_meters: number;
    primary_incident_id: string;
    trigger_incident_id: string;
    explanation: string;
    created_at?: string;
  }>;
  open_incidents: Array<{
    id: string;
    title: string;
    category: string;
    severity: string;
    priority_score: number;
    priority_level: string;
    status: string;
    assigned_to?: string;
    created_at?: string;
    is_demo?: boolean;
  }>;
  root_cause_analysis: RootCauseAnalysisResponse;
  tools_executed: any[];
  findings: Record<string, any>;
}


