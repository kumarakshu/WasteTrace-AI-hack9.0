from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class StatusHistorySchema(BaseModel):
    id: int
    incident_id: str
    from_status: str
    to_status: str
    changed_by_role: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ResolutionEvidenceSchema(BaseModel):
    id: int
    incident_id: str
    submitted_by_role: str
    image_url: Optional[str] = None
    notes: Optional[str] = None
    cleanup_timestamp: datetime
    is_verified: bool
    verified_by_role: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RecurrenceAlertSchema(BaseModel):
    id: int
    location_id: Optional[int] = None
    primary_incident_id: str
    trigger_incident_id: str
    category: str
    distance_meters: float
    incident_count: int
    rule_triggered: str
    explanation: str
    is_post_resolution: bool
    created_at: datetime

    class Config:
        from_attributes = True

class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    category: str = Field(..., description="Waste issue category")
    description: str = Field(..., min_length=5)
    severity: str = Field(default="Medium", description="Low, Medium, High, Critical")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    address_text: str = Field(..., min_length=3)
    is_anonymous: bool = Field(default=False)
    location_id: Optional[int] = None
    image_url: Optional[str] = None

class IncidentResponse(BaseModel):
    id: str
    location_id: Optional[int] = None
    title: str
    category: str
    description: str
    severity: str
    latitude: float
    longitude: float
    address_text: str
    status: str
    is_anonymous: bool
    image_url: Optional[str] = None
    image_analysis: Optional[str] = None
    assigned_to: Optional[str] = None
    priority_score: float
    priority_level: str
    priority_breakdown: Optional[Dict[str, Any]] = None
    recurrence_count: int
    is_recurring: bool
    is_demo: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    history: List[StatusHistorySchema] = []
    evidence: List[ResolutionEvidenceSchema] = []

    class Config:
        from_attributes = True

class IncidentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[IncidentResponse]

class StatusChangeRequest(BaseModel):
    to_status: str
    role: str = "Supervisor"
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class EvidenceSubmissionRequest(BaseModel):
    role: str = "Field Worker"
    notes: Optional[str] = None
    image_url: Optional[str] = None

class VerificationRequest(BaseModel):
    approved: bool
    role: str = "Supervisor"
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class LocationResponse(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    zone: str
    is_demo: bool = False
    active_incidents_count: int = 0
    recurrence_count: int = 0
    highest_severity: str = "Low"
    highest_priority_score: float = 0.0

    class Config:
        from_attributes = True

class HotspotPoint(BaseModel):
    id: str
    location_id: Optional[int] = None
    location_name: str
    latitude: float
    longitude: float
    incident_count: int
    recurrence_count: int
    severity: str
    priority_score: float
    priority_level: str
    is_recurring: bool
    is_demo: bool = False
    category: str
    status: str
    last_reported: datetime

class DashboardSummaryResponse(BaseModel):
    total_incidents: int
    open_incidents: int
    recurring_locations: int
    high_priority_incidents: int
    verified_resolutions: int
    recurrence_after_resolution: int
    severity_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    status_distribution: Dict[str, int]
    resolution_rate_percent: float

class AIImageAnalysisResponse(BaseModel):
    suggested_category: str
    confidence: float
    severity_estimate: str
    detected_objects: List[str]
    observation_summary: str
    provider: str
    is_fallback: bool
    notes: Optional[str] = None

class AIInsightResponse(BaseModel):
    id: str
    title: str
    type: str
    severity: str
    pattern: str
    locations_affected: int
    supporting_incidents: List[str]
    why_it_matters: str
    suggested_action: str
    limitations_and_uncertainty: str

class SystemSettingsSchema(BaseModel):
    recurrence_radius_meters: float
    recurrence_window_days: int
    follow_up_window_days: int
    weight_severity: float
    weight_recurrence: float
    weight_duration: float
    weight_evidence: float

class AgentAuditRequest(BaseModel):
    audit_type: str = Field(default="recurrence_audit", description="recurrence_audit, resolution_audit, location_deep_dive, priority_audit, root_cause_audit, or dispatch_queue_audit")
    target_id: Optional[str] = None

class AgentAuditResponse(BaseModel):
    status: str
    audit_type: str
    generated_at: str
    tools_executed: List[Dict[str, Any]]
    findings: Dict[str, Any]

class DispatchQueueItem(BaseModel):
    id: str
    title: str
    location_id: Optional[int] = None
    location_name: str
    zone: str
    address_text: str
    category: str
    severity: str
    priority_score: float
    priority_level: str
    recurrence_count: int
    is_recurring: bool
    status: str
    assigned_to: Optional[str] = None
    recommended_action: str
    created_at: datetime
    latitude: float
    longitude: float
    is_demo: bool = False

    class Config:
        from_attributes = True

class DispatchQueueResponse(BaseModel):
    total: int
    critical_count: int
    high_count: int
    unassigned_count: int
    items: List[DispatchQueueItem]

class DispatchAssignmentRequest(BaseModel):
    incident_id: str
    assigned_to: str
    role: str = "Supervisor"
    notes: Optional[str] = None

class RootCauseAnalysisResponse(BaseModel):
    location_id: int
    location_name: str
    address: str
    zone: str
    coordinates: List[float]
    total_incidents: int
    open_incidents_count: int
    verified_incidents_count: int
    post_resolution_relapse_count: int
    mean_time_to_relapse_days: Optional[float] = None
    dominant_category: str
    dominant_category_percentage: float
    evidence_compliance_percentage: float
    verified_observations: List[Dict[str, Any]]
    plausible_hypotheses: List[Dict[str, Any]]
    missing_information: List[str]
    recommendations: List[Dict[str, Any]]
    generated_at: str

class HotspotInvestigationResponse(BaseModel):
    location: LocationResponse
    timeline: List[Dict[str, Any]]
    nearby_incidents: List[Dict[str, Any]]
    cleanups: List[Dict[str, Any]]
    post_resolution_relapses: List[Dict[str, Any]]
    open_incidents: List[Dict[str, Any]]
    root_cause_analysis: RootCauseAnalysisResponse
    tools_executed: List[Dict[str, Any]]
    findings: Dict[str, Any]

