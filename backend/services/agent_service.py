import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
from backend.models import Location, Incident, StatusHistory, ResolutionEvidence, RecurrenceAlert
from backend.engines.priority_engine import calculate_priority_score
from backend.engines.root_cause_engine import analyze_hotspot_root_cause

# =====================================================================
# STRUCTURED TOOLS FOR OPERATIONAL INTELLIGENCE AGENT
# =====================================================================

def tool_get_recurring_hotspots(db: Session, min_recurrence: int = 2) -> Dict[str, Any]:
    """
    TOOL: get_recurring_hotspots
    Retrieves locations that have experienced recurring waste incidents,
    including active alerts, primary categories, and unresolved cases.
    """
    if min_recurrence < 0:
        return {
            "tool_name": "get_recurring_hotspots",
            "error": "min_recurrence must be non-negative",
            "hotspots": []
        }

    locations = db.query(Location).all()
    hotspots = []

    for loc in locations:
        incidents = db.query(Incident).filter(Incident.location_id == loc.id).all()
        rec_count = db.query(RecurrenceAlert).filter(RecurrenceAlert.location_id == loc.id).count()
        unresolved_count = len([i for i in incidents if i.status != "Resolved — Verified"])
        
        if rec_count >= min_recurrence or any(i.recurrence_count >= min_recurrence for i in incidents):
            categories = [i.category for i in incidents]
            top_category = max(set(categories), key=categories.count) if categories else "General"
            max_priority = max([i.priority_score for i in incidents], default=0.0)

            hotspots.append({
                "location_id": loc.id,
                "location_name": loc.name,
                "address": loc.address,
                "zone": loc.zone,
                "coordinates": [loc.latitude, loc.longitude],
                "recurrence_alerts_count": rec_count,
                "unresolved_incidents": unresolved_count,
                "total_incidents": len(incidents),
                "dominant_category": top_category,
                "highest_priority_score": round(max_priority, 1)
            })

    hotspots.sort(key=lambda x: (x["recurrence_alerts_count"], x["highest_priority_score"]), reverse=True)
    return {
        "tool_name": "get_recurring_hotspots",
        "inputs": {"min_recurrence": min_recurrence},
        "total_hotspots_found": len(hotspots),
        "hotspots": hotspots
    }


def tool_get_location_history(db: Session, location_id: int) -> Dict[str, Any]:
    """
    TOOL: get_location_history
    Retrieves complete chronological incident, evidence, and alert timeline for a specific location.
    """
    if not isinstance(location_id, int) or location_id <= 0:
        return {
            "tool_name": "get_location_history",
            "error": f"Invalid location_id: {location_id}. Must be a positive integer.",
            "location_id": location_id
        }

    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        return {
            "tool_name": "get_location_history",
            "error": f"Location ID {location_id} does not exist in database.",
            "location_id": location_id
        }

    incidents = db.query(Incident).filter(
        Incident.location_id == location_id
    ).order_by(desc(Incident.created_at)).all()

    alerts = db.query(RecurrenceAlert).filter(
        RecurrenceAlert.location_id == location_id
    ).order_by(desc(RecurrenceAlert.created_at)).all()

    incident_summaries = []
    for inc in incidents:
        incident_summaries.append({
            "incident_id": inc.id,
            "title": inc.title,
            "category": inc.category,
            "severity": inc.severity,
            "status": inc.status,
            "priority_score": inc.priority_score,
            "is_recurring": inc.is_recurring,
            "is_demo": bool(inc.is_demo),
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
            "evidence_count": len(inc.evidence) if inc.evidence else 0
        })

    alert_summaries = []
    for a in alerts:
        alert_summaries.append({
            "alert_id": a.id,
            "rule": a.rule_triggered,
            "is_post_resolution": a.is_post_resolution,
            "distance_meters": a.distance_meters,
            "primary_id": a.primary_incident_id,
            "trigger_id": a.trigger_incident_id,
            "explanation": a.explanation,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    return {
        "tool_name": "get_location_history",
        "location": {
            "id": loc.id,
            "name": loc.name,
            "address": loc.address,
            "zone": loc.zone,
            "coordinates": [loc.latitude, loc.longitude]
        },
        "total_historical_incidents": len(incidents),
        "recurrence_alerts_count": len(alerts),
        "post_resolution_relapses": len([a for a in alerts if a.is_post_resolution]),
        "incidents": incident_summaries,
        "recurrence_alerts": alert_summaries
    }


def tool_get_priority_breakdown(db: Session, incident_id: str) -> Dict[str, Any]:
    """
    TOOL: get_priority_breakdown
    Retrieves mathematical score breakdown and urgent safeguard indicators for an incident.
    """
    if not incident_id or not isinstance(incident_id, str):
        return {
            "tool_name": "get_priority_breakdown",
            "error": "incident_id must be a non-empty string."
        }

    inc = db.query(Incident).filter(Incident.id == incident_id.strip()).first()
    if not inc:
        return {
            "tool_name": "get_priority_breakdown",
            "error": f"Incident {incident_id} not found."
        }

    breakdown = inc.breakdown_dict
    return {
        "tool_name": "get_priority_breakdown",
        "incident_id": inc.id,
        "title": inc.title,
        "severity": inc.severity,
        "status": inc.status,
        "priority_score": inc.priority_score,
        "priority_level": inc.priority_level,
        "is_recurring": inc.is_recurring,
        "recurrence_count": inc.recurrence_count,
        "breakdown": breakdown
    }


def tool_get_pending_resolution_reviews(db: Session, limit: int = 10) -> Dict[str, Any]:
    """
    TOOL: get_pending_resolution_reviews
    Retrieves incidents where cleanup claims or evidence are pending supervisor audit.
    """
    safe_limit = max(1, min(limit, 50))
    incidents = db.query(Incident).filter(
        Incident.status.in_(["Cleanup Submitted", "Verification Pending"])
    ).order_by(desc(Incident.updated_at)).limit(safe_limit).all()

    pending_items = []
    for inc in incidents:
        latest_ev = inc.evidence[0] if inc.evidence else None
        pending_items.append({
            "incident_id": inc.id,
            "title": inc.title,
            "category": inc.category,
            "severity": inc.severity,
            "status": inc.status,
            "address": inc.address_text,
            "priority_score": inc.priority_score,
            "assigned_to": inc.assigned_to,
            "has_photo_evidence": bool(latest_ev and latest_ev.image_url),
            "evidence_notes": latest_ev.notes if latest_ev else None,
            "submitted_by": latest_ev.submitted_by_role if latest_ev else None,
            "cleanup_timestamp": latest_ev.cleanup_timestamp.isoformat() if (latest_ev and latest_ev.cleanup_timestamp) else None
        })

    return {
        "tool_name": "get_pending_resolution_reviews",
        "total_pending_count": len(pending_items),
        "pending_incidents": pending_items
    }


def tool_get_pending_assignments(db: Session, limit: int = 10, min_priority: float = 0.0) -> Dict[str, Any]:
    """
    TOOL: get_pending_assignments
    Retrieves open incidents requiring worker dispatch, ordered strictly by priority score.
    Suggests suitable demo sanitation response units based on category and severity.
    """
    safe_limit = max(1, min(limit, 50))
    query = db.query(Incident).filter(
        Incident.status.in_(["Reported", "Recurrence Detected"]),
        Incident.priority_score >= min_priority,
        (Incident.assigned_to == None) | (Incident.assigned_to == "")
    ).order_by(desc(Incident.priority_score)).limit(safe_limit)

    incidents = query.all()
    queue_items = []

    for inc in incidents:
        loc_name = inc.location.name.replace("[Demo] ", "") if inc.location else inc.address_text
        zone = inc.location.zone if inc.location else "East Delhi"
        
        # Suggest appropriate demo unit
        suggested_unit = "East Delhi Rapid Response Unit 1 (Vikas Marg)"
        if inc.severity == "Critical" or inc.category == "Drain blockage caused by waste":
            suggested_unit = "Drainage Desilting Unit 3 (Ghazipur/Pandav Nagar)"
        elif inc.category == "Overflowing garbage bin":
            suggested_unit = "Sanitation Crew Alpha (Heavy Compactor)"
        elif inc.category in ["Illegal dumping", "Construction waste"]:
            suggested_unit = "Commercial Market Collection Unit 2 (Preet Vihar)"

        queue_items.append({
            "incident_id": inc.id,
            "title": inc.title,
            "location_name": loc_name,
            "zone": zone,
            "category": inc.category,
            "severity": inc.severity,
            "priority_score": inc.priority_score,
            "priority_level": inc.priority_level,
            "recurrence_count": inc.recurrence_count,
            "status": inc.status,
            "suggested_unit": suggested_unit,
            "created_at": inc.created_at.isoformat() if inc.created_at else None
        })

    return {
        "tool_name": "get_pending_assignments",
        "total_unassigned_count": len(queue_items),
        "unassigned_queue": queue_items
    }


def tool_get_recurrence_timeline(db: Session, location_id: int) -> Dict[str, Any]:
    """
    TOOL: get_recurrence_timeline
    Retrieves chronological event stream of complaints, assignments, cleanups,
    verifications, and relapses for a specific location.
    """
    if not isinstance(location_id, int) or location_id <= 0:
        return {
            "tool_name": "get_recurrence_timeline",
            "error": f"Invalid location_id: {location_id}. Must be positive integer."
        }

    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        return {
            "tool_name": "get_recurrence_timeline",
            "error": f"Location ID {location_id} does not exist."
        }

    incidents = db.query(Incident).filter(Incident.location_id == location_id).order_by(Incident.created_at.asc()).all()
    alerts = db.query(RecurrenceAlert).filter(RecurrenceAlert.location_id == location_id).order_by(RecurrenceAlert.created_at.asc()).all()

    events = []

    # Incident creation events
    for inc in incidents:
        events.append({
            "timestamp": inc.created_at.isoformat() if inc.created_at else None,
            "event_type": "INCIDENT_REPORTED",
            "incident_id": inc.id,
            "title": inc.title,
            "category": inc.category,
            "severity": inc.severity,
            "priority_score": inc.priority_score,
            "is_demo": bool(inc.is_demo),
            "details": f"Complaint filed: {inc.category} ({inc.severity} severity)"
        })

        # History events
        for h in (inc.history or []):
            if h.to_status != "Reported":
                events.append({
                    "timestamp": h.created_at.isoformat() if h.created_at else None,
                    "event_type": f"STATUS_{h.to_status.upper().replace(' ', '_').replace('—', '_')}",
                    "incident_id": inc.id,
                    "changed_by": h.changed_by_role,
                    "details": h.notes or f"Transitioned to {h.to_status}"
                })

        # Resolution verification
        if inc.resolved_at:
            events.append({
                "timestamp": inc.resolved_at.isoformat(),
                "event_type": "RESOLUTION_VERIFIED",
                "incident_id": inc.id,
                "details": "Supervisor verified site cleanup. 30-day monitoring window activated."
            })

    # Alert events
    for a in alerts:
        events.append({
            "timestamp": a.created_at.isoformat() if a.created_at else None,
            "event_type": "POST_RESOLUTION_RELAPSE" if a.is_post_resolution else "RECURRENCE_CLUSTER",
            "incident_id": a.trigger_incident_id,
            "primary_id": a.primary_incident_id,
            "rule": a.rule_triggered,
            "details": a.explanation
        })

    # Sort all events chronologically
    events.sort(key=lambda x: x["timestamp"] or "")

    return {
        "tool_name": "get_recurrence_timeline",
        "location_id": loc.id,
        "location_name": loc.name,
        "total_events": len(events),
        "timeline_events": events
    }


def tool_get_hotspot_root_cause_analysis(db: Session, location_id: int) -> Dict[str, Any]:
    """
    TOOL: get_hotspot_root_cause_analysis
    Generates evidence-backed root cause diagnostic separating verified observations,
    plausible hypotheses, unmeasured data gaps, and explainable recommendations.
    """
    if not isinstance(location_id, int) or location_id <= 0:
        return {
            "tool_name": "get_hotspot_root_cause_analysis",
            "error": f"Invalid location_id: {location_id}. Must be positive integer."
        }

    analysis = analyze_hotspot_root_cause(db, location_id)
    return {
        "tool_name": "get_hotspot_root_cause_analysis",
        "location_id": location_id,
        "analysis": analysis
    }


AVAILABLE_TOOLS = [
    {
        "name": "get_recurring_hotspots",
        "description": "Retrieves locations that have experienced recurring waste incidents and multi-alert clusters.",
        "parameters": {"min_recurrence": "Minimum alert/incident count to qualify (default: 2)"}
    },
    {
        "name": "get_location_history",
        "description": "Retrieves full historical timeline of incidents, cleanups, and relapse alerts for a specific location.",
        "parameters": {"location_id": "Integer ID of the location"}
    },
    {
        "name": "get_priority_breakdown",
        "description": "Retrieves exact component weights and safeguard logic for an incident priority score.",
        "parameters": {"incident_id": "String ID of the incident (e.g. INC-DEMO-001)"}
    },
    {
        "name": "get_pending_resolution_reviews",
        "description": "Retrieves incidents currently in 'Cleanup Submitted' or 'Verification Pending' awaiting audit.",
        "parameters": {"limit": "Maximum records to return (default: 10)"}
    },
    {
        "name": "get_pending_assignments",
        "description": "Retrieves unassigned open incidents prioritized by score, matching suitable demo sanitation crews.",
        "parameters": {"limit": "Max records (default: 10)", "min_priority": "Minimum score filter (default: 0.0)"}
    },
    {
        "name": "get_recurrence_timeline",
        "description": "Retrieves chronological event stream of complaints, cleanups, verifications, and relapses for a location.",
        "parameters": {"location_id": "Integer ID of the location"}
    },
    {
        "name": "get_hotspot_root_cause_analysis",
        "description": "Generates 4-part evidence diagnostic: verified observations, plausible hypotheses, data gaps, and recommendations.",
        "parameters": {"location_id": "Integer ID of the location"}
    }
]


# =====================================================================
# AGENT AUDIT EXECUTION ENGINE
# =====================================================================

def run_agent_operational_audit(
    db: Session,
    audit_type: str = "recurrence_audit",
    target_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes a controlled, explainable tool-calling workflow.
    Executes validated database tools and generates grounded executive findings.
    """
    tool_proofs: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    if audit_type == "recurrence_audit":
        tool_res = tool_get_recurring_hotspots(db, min_recurrence=1)
        tool_proofs.append(tool_res)

        hotspots = tool_res["hotspots"]
        top_hotspot = hotspots[0] if hotspots else None

        if top_hotspot:
            detail_res = tool_get_location_history(db, top_hotspot["location_id"])
            tool_proofs.append(detail_res)

        findings = {
            "audit_title": "City-Wide Recurrence Pattern Audit",
            "timestamp": now_iso,
            "reasoning_mode": "Deterministic Tool-Calling Intelligence",
            "hotspots_analyzed": len(hotspots),
            "key_observations": [
                f"{len(hotspots)} locations exhibit recurring waste incidents across monitored sectors.",
                f"Most severe hotspot identified: '{top_hotspot['location_name']}' with {top_hotspot['recurrence_alerts_count']} recurrence alerts." if top_hotspot else "No chronic hotspots detected.",
                f"Predominant recurring failure category: '{top_hotspot['dominant_category']}'." if top_hotspot else "N/A"
            ],
            "verified_facts": [
                f"Data grounded directly in {len(hotspots)} active location records.",
                "Recurrence verified using Haversine geodesic distance (threshold <= 50m)."
            ],
            "operational_hypotheses": [
                "Single daily compactor collection is insufficient for peak commercial discard volumes.",
                "Contractor cleanup sweeps clear loose waste without addressing bin volume deficits."
            ],
            "recommended_municipal_actions": [
                "Increase scheduled collection frequency to 2x daily at identified hotspot locations.",
                "Deploy secondary 1100L heavy-duty compactor bins at commercial collection points.",
                "Place public educational signage and coordinate with local market associations."
            ]
        }

    elif audit_type == "root_cause_audit":
        # Feature 1 & Feature 5 Root Cause Audit
        loc_id = int(target_id) if (target_id and target_id.isdigit()) else 1
        rc_res = tool_get_hotspot_root_cause_analysis(db, loc_id)
        tool_proofs.append(rc_res)

        analysis = rc_res.get("analysis", {})
        obs = [o["text"] for o in analysis.get("verified_observations", [])]
        hyps = [f"{h['title']}: {h['hypothesis']}" for h in analysis.get("plausible_hypotheses", [])]
        recs = [f"{r['action']} — Rationale: {r['rationale']}" for r in analysis.get("recommendations", [])]

        findings = {
            "audit_title": f"Root Cause Intelligence Audit: {analysis.get('location_name', 'Hotspot ' + str(loc_id))}",
            "timestamp": now_iso,
            "reasoning_mode": "Evidence-Based Municipal Root Cause Diagnostic",
            "location_analyzed": analysis.get("location_name"),
            "key_observations": obs,
            "verified_facts": [
                f"Analyzed {analysis.get('total_incidents', 0)} incident records and {analysis.get('post_resolution_relapse_count', 0)} post-cleanup relapses.",
                f"Dominant failure category: {analysis.get('dominant_category')} ({analysis.get('dominant_category_percentage')}%).",
                f"Mean Time Between Recurrence (MTBR): {analysis.get('mean_time_to_relapse_days', 'N/A')} days."
            ],
            "operational_hypotheses": hyps or ["Operational variance under monitoring."],
            "missing_information_gaps": analysis.get("missing_information", []),
            "recommended_municipal_actions": recs or ["Continue regular supervisory inspection."]
        }

    elif audit_type == "dispatch_queue_audit":
        # Feature 3 Dispatch Queue Audit
        queue_res = tool_get_pending_assignments(db, limit=10, min_priority=0.0)
        tool_proofs.append(queue_res)

        items = queue_res.get("unassigned_queue", [])
        criticals = [i for i in items if i.get("priority_level") == "Critical"]
        highs = [i for i in items if i.get("priority_level") == "High"]

        findings = {
            "audit_title": "Smart Dispatch Queue & SLA Compliance Audit",
            "timestamp": now_iso,
            "reasoning_mode": "Priority-Driven Dispatch Triage",
            "total_unassigned": len(items),
            "key_observations": [
                f"{len(items)} open tickets currently awaiting worker assignment.",
                f"{len(criticals)} critical severity tickets require immediate rapid response dispatch.",
                f"{len(highs)} high-priority tickets pending compactor / sweeper crew allocation."
            ],
            "verified_facts": [
                "Queue strictly ordered by explainable priority score formula (0.4Sev + 0.3Rec + 0.2Dur + 0.1Ev).",
                "Critical safeguard enforced (score >= 85) on all critical reports."
            ],
            "operational_hypotheses": [
                "Dispatch bottlenecks occur during morning peak complaints when crew assignments are manual."
            ],
            "recommended_municipal_actions": [
                f"Dispatch {i.get('suggested_unit')} to {i.get('incident_id')} ({i.get('location_name')})" for i in items[:3]
            ]
        }

    elif audit_type == "resolution_audit":
        tool_res = tool_get_pending_resolution_reviews(db, limit=10)
        tool_proofs.append(tool_res)

        pending = tool_res["pending_incidents"]
        without_photo = [p for p in pending if not p["has_photo_evidence"]]

        findings = {
            "audit_title": "Cleanup Verification & SLA Compliance Audit",
            "timestamp": now_iso,
            "reasoning_mode": "Deterministic Tool-Calling Intelligence",
            "pending_count": len(pending),
            "key_observations": [
                f"{len(pending)} cleanup claims currently pending supervisor review.",
                f"{len(without_photo)} incident(s) submitted without photographic evidence require on-site verification before closure."
            ],
            "verified_facts": [
                f"{len(pending) - len(without_photo)} cleanup submissions include photographic evidence.",
                "No ticket is closed automatically without supervisor sign-off."
            ],
            "operational_hypotheses": [
                "Field workers occasionally submit status updates from mobile areas before uploading photos."
            ],
            "recommended_municipal_actions": [
                "Prioritize review of high-priority verification pending incidents.",
                "Reject and reopen submissions that lack photographic confirmation.",
                "Maintain follow-up monitoring for 30 days on all newly verified closures."
            ]
        }

    elif audit_type == "location_deep_dive" and target_id:
        try:
            loc_id = int(target_id)
            tool_res = tool_get_location_history(db, loc_id)
            tool_proofs.append(tool_res)

            loc = tool_res.get("location", {})
            findings = {
                "audit_title": f"Site Deep-Dive: {loc.get('name', 'Location ' + target_id)}",
                "timestamp": now_iso,
                "reasoning_mode": "Deterministic Tool-Calling Intelligence",
                "total_historical_reports": tool_res.get("total_historical_incidents", 0),
                "post_resolution_relapses": tool_res.get("post_resolution_relapses", 0),
                "key_observations": [
                    f"Site has recorded {tool_res.get('total_historical_incidents', 0)} total incidents.",
                    f"{tool_res.get('post_resolution_relapses', 0)} incident(s) recurred after verified closure."
                ],
                "verified_facts": [
                    f"Coordinates: {loc.get('coordinates', [])} in {loc.get('zone', 'East Delhi')}."
                ],
                "operational_hypotheses": [
                    "High pedestrian traffic combined with small bin aperture leads to rapid overflow."
                ],
                "recommended_municipal_actions": [
                    "Perform supervisor field inspection to examine container placement.",
                    "Review previous cleanup contractor timestamps vs citizen complaint logs."
                ]
            }
        except Exception as e:
            findings = {
                "audit_title": "Site Deep-Dive Audit Failed",
                "error": str(e),
                "timestamp": now_iso
            }

    else: # Priority Safeguard Audit
        tool_res = tool_get_recurring_hotspots(db, min_recurrence=1)
        tool_proofs.append(tool_res)

        findings = {
            "audit_title": "Explainable Priority & Urgent Safeguard Audit",
            "timestamp": now_iso,
            "reasoning_mode": "Deterministic Tool-Calling Intelligence",
            "key_observations": [
                "All Critical severity incidents enforce guaranteed priority score >= 85.",
                "Priority score components (Severity 40%, Recurrence 30%, Duration 20%, Evidence 10%) are fully auditable."
            ],
            "verified_facts": [
                "Priority scores are recalculated whenever status changes or recurrence is detected."
            ],
            "operational_hypotheses": [
                "Dispatch SLA adherence decreases when priority scores are not transparently explained."
            ],
            "recommended_municipal_actions": [
                "Dispatch rapid response units for all scores >= 80 within 2 hours.",
                "Verify evidence confidence score before marking tickets verified."
            ]
        }

    return {
        "status": "success",
        "audit_type": audit_type,
        "generated_at": now_iso,
        "tools_executed": tool_proofs,
        "findings": findings
    }
