import os
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_, and_, func

from backend.config import settings
from backend.database import Base, engine, get_db
from backend.models import (
    Location, Incident, StatusHistory, ResolutionEvidence, RecurrenceAlert, SystemSetting
)
from backend.schemas import (
    IncidentCreate, IncidentResponse, IncidentListResponse,
    StatusChangeRequest, EvidenceSubmissionRequest, VerificationRequest,
    LocationResponse, HotspotPoint, DashboardSummaryResponse,
    AIImageAnalysisResponse, AIInsightResponse, SystemSettingsSchema,
    RecurrenceAlertSchema, AgentAuditRequest, AgentAuditResponse,
    DispatchQueueItem, DispatchQueueResponse, DispatchAssignmentRequest,
    RootCauseAnalysisResponse, HotspotInvestigationResponse
)
from backend.engines.recurrence_engine import evaluate_recurrence_for_incident, resolve_or_create_location
from backend.engines.priority_engine import update_incident_priority, calculate_priority_score
from backend.engines.root_cause_engine import analyze_hotspot_root_cause
from backend.services.ai_service import analyze_waste_image, generate_actionable_insights
from backend.services.agent_service import (
    run_agent_operational_audit, AVAILABLE_TOOLS, tool_get_recurrence_timeline
)
from backend.seed import seed_database, reset_database

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WasteTrace AI API",
    description="Intelligent waste-management incident tracking and recurrence detection platform",
    version=settings.VERSION
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# --- Startup Event: Auto-seed if database is empty ---
@app.on_event("startup")
def startup_populate_demo_data():
    if os.environ.get("TESTING") == "1":
        return
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        count = db.query(Incident).count()
        if count == 0:
            seed_database(db)
    finally:
        db.close()


# --- Health Check ---
@app.get("/api/v1/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected",
        "gemini_api_configured": bool(settings.GEMINI_API_KEY)
    }


# --- Dashboard Summary ---
@app.get("/api/v1/dashboard/summary", response_model=DashboardSummaryResponse, tags=["Dashboard"])
def get_dashboard_summary(db: Session = Depends(get_db)):
    total = db.query(Incident).count()
    open_incidents = db.query(Incident).filter(Incident.status != "Resolved — Verified").count()
    recurring_locs = db.query(func.distinct(Incident.location_id)).filter(
        Incident.is_recurring == True,
        Incident.location_id != None
    ).count()
    
    high_priority = db.query(Incident).filter(
        Incident.priority_score >= 60.0,
        Incident.status != "Resolved — Verified"
    ).count()

    verified_res = db.query(Incident).filter(Incident.status == "Resolved — Verified").count()

    recurrence_post_res = db.query(RecurrenceAlert).filter(
        RecurrenceAlert.is_post_resolution == True
    ).count()

    # Severity distribution
    sev_counts = db.query(Incident.severity, func.count(Incident.id)).group_by(Incident.severity).all()
    sev_dist = {s[0]: s[1] for s in sev_counts}
    for k in ["Critical", "High", "Medium", "Low"]:
        sev_dist.setdefault(k, 0)

    # Category distribution
    cat_counts = db.query(Incident.category, func.count(Incident.id)).group_by(Incident.category).all()
    cat_dist = {c[0]: c[1] for c in cat_counts}

    # Status distribution
    status_counts = db.query(Incident.status, func.count(Incident.id)).group_by(Incident.status).all()
    status_dist = {st[0]: st[1] for st in status_counts}

    res_rate = round((verified_res / total * 100.0) if total > 0 else 0.0, 1)

    return DashboardSummaryResponse(
        total_incidents=total,
        open_incidents=open_incidents,
        recurring_locations=recurring_locs,
        high_priority_incidents=high_priority,
        verified_resolutions=verified_res,
        recurrence_after_resolution=recurrence_post_res,
        severity_distribution=sev_dist,
        category_distribution=cat_dist,
        status_distribution=status_dist,
        resolution_rate_percent=res_rate
    )


# --- Incident Reporting & Management ---
@app.post("/api/v1/incidents", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED, tags=["Incidents"])
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    # Generate ID
    year = datetime.now().year
    count = db.query(Incident).count() + 1
    inc_id = f"INC-{year}-{count:04d}"

    # Auto-resolve or create persistent Location so location_id is never orphaned
    loc_id = data.location_id
    if not loc_id:
        loc_id = resolve_or_create_location(
            db,
            latitude=data.latitude,
            longitude=data.longitude,
            address_text=data.address_text,
            name=data.title
        )

    now = datetime.now(timezone.utc)
    incident = Incident(
        id=inc_id,
        location_id=loc_id,
        title=data.title,
        category=data.category,
        description=data.description,
        severity=data.severity,
        latitude=data.latitude,
        longitude=data.longitude,
        address_text=data.address_text,
        status="Reported",
        is_anonymous=data.is_anonymous,
        image_url=data.image_url,
        created_at=now,
        updated_at=now
    )
    db.add(incident)
    db.flush()

    # Record initial StatusHistory
    history = StatusHistory(
        incident_id=incident.id,
        from_status="None",
        to_status="Reported",
        changed_by_role="Citizen" if not data.is_anonymous else "Anonymous Citizen",
        notes="Incident report registered through public submission portal.",
        created_at=now
    )
    db.add(history)

    # Recurrence detection against historical records
    evaluate_recurrence_for_incident(
        db,
        incident,
        radius_meters=settings.DEFAULT_RECURRENCE_RADIUS_METERS,
        window_days=settings.DEFAULT_RECURRENCE_WINDOW_DAYS,
        follow_up_days=settings.DEFAULT_FOLLOW_UP_WINDOW_DAYS
    )

    # Calculate explainable priority score
    is_post_res = (incident.status == "Recurrence Detected")
    update_incident_priority(incident, is_post_resolution=is_post_res, now=now)

    db.commit()
    db.refresh(incident)
    return incident


@app.get("/api/v1/incidents", response_model=IncidentListResponse, tags=["Incidents"])
def list_incidents(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    location_id: Optional[int] = None,
    is_recurring: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(created_at|priority_score|severity|status)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Incident)

    if category:
        query = query.filter(Incident.category == category)
    if severity:
        query = query.filter(Incident.severity == severity)
    if status:
        query = query.filter(Incident.status == status)
    if location_id:
        query = query.filter(Incident.location_id == location_id)
    if is_recurring is not None:
        query = query.filter(Incident.is_recurring == is_recurring)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Incident.id.ilike(search_filter),
                Incident.title.ilike(search_filter),
                Incident.description.ilike(search_filter),
                Incident.address_text.ilike(search_filter)
            )
        )

    total = query.count()

    sort_column = getattr(Incident, sort_by)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return IncidentListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items
    )


@app.get("/api/v1/incidents/{incident_id}", response_model=IncidentResponse, tags=["Incidents"])
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    return inc


@app.post("/api/v1/incidents/{incident_id}/status", response_model=IncidentResponse, tags=["Incidents"])
def update_incident_status(
    incident_id: str,
    req: StatusChangeRequest,
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    allowed_statuses = [
        "Reported", "Assigned", "Cleanup Submitted", "Verification Pending",
        "Resolved — Verified", "Recurrence Detected", "Reopened"
    ]
    if req.to_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {req.to_status}")

    prev_status = inc.status

    # Validate state transition rules
    VALID_TRANSITIONS = {
        "Reported": ["Assigned", "Cleanup Submitted"],
        "Assigned": ["Cleanup Submitted", "Verification Pending", "Reopened"],
        "Cleanup Submitted": ["Verification Pending", "Resolved — Verified", "Reopened"],
        "Verification Pending": ["Resolved — Verified", "Reopened", "Cleanup Submitted"],
        "Resolved — Verified": ["Recurrence Detected", "Reopened"],
        "Recurrence Detected": ["Assigned", "Cleanup Submitted"],
        "Reopened": ["Assigned", "Cleanup Submitted"]
    }

    if req.to_status != prev_status:
        allowed = VALID_TRANSITIONS.get(prev_status, [])
        if req.to_status not in allowed:
            if req.role != "Supervisor":
                raise HTTPException(
                    status_code=400,
                    detail=f"Illegal state transition from '{prev_status}' to '{req.to_status}'. Only Supervisors can execute administrative overrides."
                )

    inc.status = req.to_status
    if req.assigned_to:
        inc.assigned_to = req.assigned_to

    now = datetime.now(timezone.utc)
    inc.updated_at = now

    if req.to_status == "Resolved — Verified":
        inc.resolved_at = now

    # Record history
    history = StatusHistory(
        incident_id=inc.id,
        from_status=prev_status,
        to_status=req.to_status,
        changed_by_role=req.role,
        notes=req.notes or f"Status changed from '{prev_status}' to '{req.to_status}' by {req.role}.",
        created_at=now
    )
    db.add(history)

    # Re-calculate priority score with updated status
    update_incident_priority(inc, is_post_resolution=(inc.status == "Recurrence Detected"), now=now)

    db.commit()
    db.refresh(inc)
    return inc


@app.post("/api/v1/incidents/{incident_id}/evidence", response_model=IncidentResponse, tags=["Resolution"])
def submit_cleanup_evidence(
    incident_id: str,
    req: EvidenceSubmissionRequest,
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = datetime.now(timezone.utc)

    evidence = ResolutionEvidence(
        incident_id=inc.id,
        submitted_by_role=req.role,
        image_url=req.image_url,
        notes=req.notes or "Cleanup completion photo evidence submitted for supervisor audit.",
        cleanup_timestamp=now,
        is_verified=False,
        created_at=now
    )
    db.add(evidence)

    prev_status = inc.status
    inc.status = "Verification Pending"
    inc.updated_at = now

    history = StatusHistory(
        incident_id=inc.id,
        from_status=prev_status,
        to_status="Verification Pending",
        changed_by_role=req.role,
        notes="Cleanup evidence submitted. Awaiting supervisor inspection.",
        created_at=now
    )
    db.add(history)

    update_incident_priority(inc, is_post_resolution=False, now=now)

    db.commit()
    db.refresh(inc)
    return inc


@app.post("/api/v1/incidents/{incident_id}/verify", response_model=IncidentResponse, tags=["Resolution"])
def verify_cleanup_resolution(
    incident_id: str,
    req: VerificationRequest,
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = datetime.now(timezone.utc)
    prev_status = inc.status

    # Get latest evidence
    latest_evidence = db.query(ResolutionEvidence).filter(
        ResolutionEvidence.incident_id == inc.id
    ).order_by(desc(ResolutionEvidence.created_at)).first()

    if req.approved:
        inc.status = "Resolved — Verified"
        inc.resolved_at = now
        if latest_evidence:
            latest_evidence.is_verified = True
            latest_evidence.verified_by_role = req.role
            latest_evidence.verified_at = now

        history = StatusHistory(
            incident_id=inc.id,
            from_status=prev_status,
            to_status="Resolved — Verified",
            changed_by_role=req.role,
            notes=req.notes or "Cleanup evidence verified. Location marked resolved under follow-up monitoring.",
            created_at=now
        )
    else:
        inc.status = "Reopened"
        if latest_evidence:
            latest_evidence.rejection_reason = req.rejection_reason or "Evidence insufficient or location still contaminated."
        
        history = StatusHistory(
            incident_id=inc.id,
            from_status=prev_status,
            to_status="Reopened",
            changed_by_role=req.role,
            notes=f"Cleanup rejected by {req.role}. Reason: {req.rejection_reason or 'Evidence rejected'}",
            created_at=now
        )

    db.add(history)
    inc.updated_at = now
    update_incident_priority(inc, is_post_resolution=False, now=now)

    db.commit()
    db.refresh(inc)
    return inc


# --- Hotspots & Locations ---
@app.get("/api/v1/locations", response_model=List[LocationResponse], tags=["Locations"])
def list_locations(db: Session = Depends(get_db)):
    locs = db.query(Location).all()
    results = []

    for loc in locs:
        active_count = db.query(Incident).filter(
            Incident.location_id == loc.id,
            Incident.status != "Resolved — Verified"
        ).count()

        rec_count = db.query(RecurrenceAlert).filter(
            RecurrenceAlert.location_id == loc.id
        ).count()

        highest_sev = "Low"
        incidents = db.query(Incident).filter(Incident.location_id == loc.id).all()
        sev_rank = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
        max_rank = 1
        max_priority = 0.0

        for inc in incidents:
            r = sev_rank.get(inc.severity, 1)
            if r > max_rank:
                max_rank = r
                highest_sev = inc.severity
            if inc.priority_score > max_priority:
                max_priority = inc.priority_score

        results.append(LocationResponse(
            id=loc.id,
            name=loc.name,
            address=loc.address,
            latitude=loc.latitude,
            longitude=loc.longitude,
            zone=loc.zone,
            is_demo=bool(loc.is_demo),
            active_incidents_count=active_count,
            recurrence_count=rec_count,
            highest_severity=highest_sev,
            highest_priority_score=max_priority
        ))

    return results


@app.get("/api/v1/hotspots", response_model=List[HotspotPoint], tags=["Locations"])
def get_hotspots(db: Session = Depends(get_db)):
    incidents = db.query(Incident).order_by(desc(Incident.created_at)).all()
    hotspots = []

    for inc in incidents:
        loc_name = inc.location.name if inc.location else inc.address_text
        hotspots.append(HotspotPoint(
            id=inc.id,
            location_id=inc.location_id,
            location_name=loc_name,
            latitude=inc.latitude,
            longitude=inc.longitude,
            incident_count=inc.recurrence_count + 1,
            recurrence_count=inc.recurrence_count,
            severity=inc.severity,
            priority_score=inc.priority_score,
            priority_level=inc.priority_level,
            is_recurring=inc.is_recurring,
            is_demo=bool(inc.is_demo),
            category=inc.category,
            status=inc.status,
            last_reported=inc.created_at
        ))

    return hotspots


# --- Recurrence Alerts ---
@app.get("/api/v1/recurrence-alerts", response_model=List[RecurrenceAlertSchema], tags=["Recurrence"])
def list_recurrence_alerts(db: Session = Depends(get_db)):
    alerts = db.query(RecurrenceAlert).order_by(desc(RecurrenceAlert.created_at)).all()
    return alerts


# --- AI Endpoints ---
@app.post("/api/v1/ai/analyze-image", response_model=AIImageAnalysisResponse, tags=["AI"])
async def analyze_image_endpoint(file: UploadFile = File(...)):
    # Validate extension
    allowed = [".jpg", ".jpeg", ".png", ".webp"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only image files (.jpg, .jpeg, .png, .webp) are allowed")

    # Save safely
    safe_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, safe_name)
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    analysis = await analyze_waste_image(filepath, mime_type=file.content_type or "image/jpeg")
    return AIImageAnalysisResponse(
        suggested_category=analysis.get("suggested_category", "Overflowing garbage bin"),
        confidence=analysis.get("confidence", 0.70),
        severity_estimate=analysis.get("severity_estimate", "Medium"),
        detected_objects=analysis.get("detected_objects", ["Waste accumulation"]),
        observation_summary=analysis.get("observation_summary", "Waste materials detected."),
        provider=analysis.get("provider", "Local Fallback"),
        is_fallback=analysis.get("is_fallback", True),
        notes=analysis.get("notes")
    )


@app.get("/api/v1/ai/insights", response_model=List[AIInsightResponse], tags=["AI"])
def get_insights_endpoint(db: Session = Depends(get_db)):
    insights = generate_actionable_insights(db)
    return insights


# --- Operational Intelligence Agent (Controlled Tool-Calling) ---
@app.get("/api/v1/agent/tools", tags=["Agent"])
def get_agent_tools():
    return {
        "status": "active",
        "agent_name": "WasteTrace Operational Intelligence Agent",
        "description": "Controlled tool-calling agent with read-only database query tools for grounded municipal decision support.",
        "tools": AVAILABLE_TOOLS
    }


@app.post("/api/v1/agent/run-audit", response_model=AgentAuditResponse, tags=["Agent"])
def run_agent_audit_endpoint(payload: AgentAuditRequest, db: Session = Depends(get_db)):
    result = run_agent_operational_audit(
        db,
        audit_type=payload.audit_type,
        target_id=payload.target_id
    )
    return AgentAuditResponse(
        status=result["status"],
        audit_type=result["audit_type"],
        generated_at=result["generated_at"],
        tools_executed=result["tools_executed"],
        findings=result["findings"]
    )


# --- Smart Dispatch Queue & Worker Assignment ---
@app.get("/api/v1/dispatch/queue", response_model=DispatchQueueResponse, tags=["Dispatch"])
def get_dispatch_queue(
    status: Optional[str] = None,
    priority_level: Optional[str] = None,
    zone: Optional[str] = None,
    unassigned_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    else:
        query = query.filter(Incident.status != "Resolved — Verified")

    if priority_level:
        query = query.filter(Incident.priority_level == priority_level)

    if zone:
        query = query.join(Location).filter(Location.zone == zone)

    if unassigned_only:
        query = query.filter(or_(Incident.assigned_to == None, Incident.assigned_to == ""))

    incidents = query.order_by(desc(Incident.priority_score), desc(Incident.created_at)).all()

    items = []
    for inc in incidents:
        loc_name = inc.location.name if inc.location else inc.address_text
        loc_zone = inc.location.zone if inc.location else "East Delhi"

        if inc.status == "Pending Verification":
            rec_action = "Supervisor photographic verification required"
        elif inc.severity == "Critical":
            rec_action = "Immediate emergency dispatch & clearance"
        elif inc.recurrence_count > 0:
            rec_action = "Inspect recurring hotspot & review capacity"
        elif inc.assigned_to:
            rec_action = f"Assigned to {inc.assigned_to} - awaiting field report"
        else:
            rec_action = "Dispatch nearest sanitation response crew"

        items.append(DispatchQueueItem(
            id=inc.id,
            title=inc.title,
            location_id=inc.location_id,
            location_name=loc_name,
            zone=loc_zone,
            address_text=inc.address_text,
            category=inc.category,
            severity=inc.severity,
            priority_score=round(inc.priority_score, 1),
            priority_level=inc.priority_level,
            recurrence_count=inc.recurrence_count,
            is_recurring=inc.is_recurring,
            status=inc.status,
            assigned_to=inc.assigned_to,
            recommended_action=rec_action,
            created_at=inc.created_at,
            latitude=inc.latitude,
            longitude=inc.longitude,
            is_demo=bool(inc.is_demo)
        ))

    critical_c = len([i for i in items if i.severity == "Critical" or i.priority_level == "Critical"])
    high_c = len([i for i in items if i.priority_level == "High"])
    unassigned_c = len([i for i in items if not i.assigned_to])

    return DispatchQueueResponse(
        total=len(items),
        critical_count=critical_c,
        high_count=high_c,
        unassigned_count=unassigned_c,
        items=items
    )


@app.post("/api/v1/dispatch/assign", response_model=DispatchQueueItem, tags=["Dispatch"])
def assign_dispatch_worker(payload: DispatchAssignmentRequest, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == payload.incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {payload.incident_id} not found")

    old_status = inc.status
    inc.assigned_to = payload.assigned_to.strip()

    if inc.status in ["Reported", "Triaged", "Open", "Recurrence Detected"]:
        inc.status = "Assigned"

    now = datetime.now(timezone.utc)
    inc.updated_at = now

    history = StatusHistory(
        incident_id=inc.id,
        from_status=old_status,
        to_status=inc.status,
        changed_by_role=payload.role,
        notes=payload.notes or f"Assigned to {payload.assigned_to}",
        created_at=now
    )
    db.add(history)
    db.commit()
    db.refresh(inc)

    loc_name = inc.location.name if inc.location else inc.address_text
    loc_zone = inc.location.zone if inc.location else "East Delhi"

    return DispatchQueueItem(
        id=inc.id,
        title=inc.title,
        location_id=inc.location_id,
        location_name=loc_name,
        zone=loc_zone,
        address_text=inc.address_text,
        category=inc.category,
        severity=inc.severity,
        priority_score=round(inc.priority_score, 1),
        priority_level=inc.priority_level,
        recurrence_count=inc.recurrence_count,
        is_recurring=inc.is_recurring,
        status=inc.status,
        assigned_to=inc.assigned_to,
        recommended_action=f"Assigned to {inc.assigned_to} - awaiting field report",
        created_at=inc.created_at,
        latitude=inc.latitude,
        longitude=inc.longitude,
        is_demo=bool(inc.is_demo)
    )


# --- Root Cause Analysis & Hotspot Investigation ---
@app.get("/api/v1/locations/{id}/root-cause", response_model=RootCauseAnalysisResponse, tags=["Locations"])
def get_location_root_cause(id: int, db: Session = Depends(get_db)):
    analysis = analyze_hotspot_root_cause(db, id)
    if "error" in analysis:
        raise HTTPException(status_code=404, detail=analysis["error"])
    return RootCauseAnalysisResponse(**analysis)


@app.get("/api/v1/locations/{id}/investigation", response_model=HotspotInvestigationResponse, tags=["Locations"])
def get_location_investigation(id: int, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == id).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Location ID {id} not found")

    active_count = db.query(Incident).filter(
        Incident.location_id == loc.id,
        Incident.status != "Resolved — Verified"
    ).count()
    rec_count = db.query(RecurrenceAlert).filter(
        RecurrenceAlert.location_id == loc.id
    ).count()
    incidents = db.query(Incident).filter(Incident.location_id == loc.id).order_by(desc(Incident.created_at)).all()

    highest_sev = "Low"
    sev_rank = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
    max_rank = 1
    max_priority = 0.0
    for inc in incidents:
        r = sev_rank.get(inc.severity, 1)
        if r > max_rank:
            max_rank = r
            highest_sev = inc.severity
        if inc.priority_score > max_priority:
            max_priority = inc.priority_score

    loc_res = LocationResponse(
        id=loc.id,
        name=loc.name,
        address=loc.address,
        latitude=loc.latitude,
        longitude=loc.longitude,
        zone=loc.zone,
        is_demo=bool(loc.is_demo),
        active_incidents_count=active_count,
        recurrence_count=rec_count,
        highest_severity=highest_sev,
        highest_priority_score=max_priority
    )

    timeline_data = tool_get_recurrence_timeline(db, id)
    timeline_events = timeline_data.get("timeline_events", [])

    cleanups = []
    evidences = db.query(ResolutionEvidence).join(Incident).filter(Incident.location_id == id).order_by(desc(ResolutionEvidence.created_at)).all()
    for ev in evidences:
        cleanups.append({
            "evidence_id": ev.id,
            "incident_id": ev.incident_id,
            "image_url": ev.image_url,
            "notes": ev.notes,
            "submitted_by_role": ev.submitted_by_role,
            "cleanup_timestamp": ev.cleanup_timestamp.isoformat() if ev.cleanup_timestamp else None,
            "is_verified": ev.is_verified,
            "verified_by_role": ev.verified_by_role,
            "verified_at": ev.verified_at.isoformat() if ev.verified_at else None,
            "rejection_reason": ev.rejection_reason
        })

    relapses = []
    alerts = db.query(RecurrenceAlert).filter(
        RecurrenceAlert.location_id == id,
        RecurrenceAlert.is_post_resolution == True
    ).order_by(desc(RecurrenceAlert.created_at)).all()
    for a in alerts:
        relapses.append({
            "alert_id": a.id,
            "rule": a.rule_triggered,
            "distance_meters": a.distance_meters,
            "primary_incident_id": a.primary_incident_id,
            "trigger_incident_id": a.trigger_incident_id,
            "explanation": a.explanation,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    open_incs = []
    for inc in incidents:
        if inc.status != "Resolved — Verified":
            open_incs.append({
                "id": inc.id,
                "title": inc.title,
                "category": inc.category,
                "severity": inc.severity,
                "priority_score": inc.priority_score,
                "priority_level": inc.priority_level,
                "status": inc.status,
                "assigned_to": inc.assigned_to,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
                "is_demo": bool(inc.is_demo)
            })

    nearby = []
    for inc in incidents:
        nearby.append({
            "id": inc.id,
            "title": inc.title,
            "category": inc.category,
            "severity": inc.severity,
            "status": inc.status,
            "is_recurring": inc.is_recurring,
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
            "is_demo": bool(inc.is_demo)
        })

    rc_analysis = analyze_hotspot_root_cause(db, id)

    return HotspotInvestigationResponse(
        location=loc_res,
        timeline=timeline_events,
        nearby_incidents=nearby,
        cleanups=cleanups,
        post_resolution_relapses=relapses,
        open_incidents=open_incs,
        root_cause_analysis=RootCauseAnalysisResponse(**rc_analysis),
        tools_executed=[
            {"tool": "get_recurrence_timeline", "events_found": len(timeline_events)},
            {"tool": "get_hotspot_root_cause_analysis", "location_id": id}
        ],
        findings={
            "total_incidents": len(incidents),
            "open_incidents": len(open_incs),
            "cleanups_count": len(cleanups),
            "relapse_count": len(relapses)
        }
    )


# --- File Upload Endpoint ---
@app.post("/api/v1/upload", tags=["Uploads"])
async def upload_file_endpoint(file: UploadFile = File(...)):
    allowed = [".jpg", ".jpeg", ".png", ".webp"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Invalid image file format")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, safe_name)
    content = await file.read()

    # Limit file size (5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 5MB")

    with open(filepath, "wb") as f:
        f.write(content)

    return {"url": f"/uploads/{safe_name}", "filename": safe_name}


# --- Settings / Config Endpoints ---
@app.get("/api/v1/settings", response_model=SystemSettingsSchema, tags=["Settings"])
def get_settings():
    return SystemSettingsSchema(
        recurrence_radius_meters=settings.DEFAULT_RECURRENCE_RADIUS_METERS,
        recurrence_window_days=settings.DEFAULT_RECURRENCE_WINDOW_DAYS,
        follow_up_window_days=settings.DEFAULT_FOLLOW_UP_WINDOW_DAYS,
        weight_severity=settings.WEIGHT_SEVERITY,
        weight_recurrence=settings.WEIGHT_RECURRENCE,
        weight_duration=settings.WEIGHT_DURATION,
        weight_evidence=settings.WEIGHT_EVIDENCE
    )


@app.put("/api/v1/settings", response_model=SystemSettingsSchema, tags=["Settings"])
def update_settings(payload: SystemSettingsSchema):
    settings.DEFAULT_RECURRENCE_RADIUS_METERS = payload.recurrence_radius_meters
    settings.DEFAULT_RECURRENCE_WINDOW_DAYS = payload.recurrence_window_days
    settings.DEFAULT_FOLLOW_UP_WINDOW_DAYS = payload.follow_up_window_days
    settings.WEIGHT_SEVERITY = payload.weight_severity
    settings.WEIGHT_RECURRENCE = payload.weight_recurrence
    settings.WEIGHT_DURATION = payload.weight_duration
    settings.WEIGHT_EVIDENCE = payload.weight_evidence
    return payload


# --- Demo Control Endpoints ---
@app.post("/api/v1/demo/seed", tags=["Demo"])
def api_seed_demo_data(db: Session = Depends(get_db)):
    count = seed_database(db)
    return {
        "status": "success",
        "message": f"Successfully reseeded database with {count} demonstration incidents and locations.",
        "incident_count": count
    }


@app.post("/api/v1/demo/reset", tags=["Demo"])
def api_reset_demo_data(db: Session = Depends(get_db)):
    reset_database(db)
    return {
        "status": "success",
        "message": "Database cleared of all demonstration records."
    }
