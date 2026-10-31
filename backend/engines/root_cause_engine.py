from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from backend.models import Location, Incident, StatusHistory, ResolutionEvidence, RecurrenceAlert
from backend.engines.recurrence_engine import haversine_distance, are_categories_compatible

def analyze_hotspot_root_cause(db: Session, location_id: int) -> Dict[str, Any]:
    """
    Evidence-based root cause diagnostic engine for municipal supervisors.
    Analyzes:
    1. Incident frequency & category concentration
    2. Recurrence patterns (active clusters vs post-resolution relapses)
    3. Elapsed time between verified cleanup and subsequent complaints (MTBR)
    4. Severity profile & urgent safeguards
    5. Resolution compliance & photographic evidence rates
    
    Outputs strictly separated into:
    A. Verified Observations (Grounded in record IDs and DB metrics)
    B. Plausible Hypotheses (Clearly identified as hypotheses, not proven facts)
    C. Missing Information (Explicitly highlighting unmeasured operational variables)
    D. Explainable Recommendations (With measurements, confidence, and verification needed)
    """
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        return {
            "error": f"Location ID {location_id} does not exist.",
            "location_id": location_id
        }

    incidents = db.query(Incident).filter(
        Incident.location_id == location_id
    ).order_by(Incident.created_at.asc()).all()

    alerts = db.query(RecurrenceAlert).filter(
        RecurrenceAlert.location_id == location_id
    ).order_by(RecurrenceAlert.created_at.asc()).all()

    total_incidents = len(incidents)
    if total_incidents == 0:
        return {
            "location_id": loc.id,
            "location_name": loc.name,
            "address": loc.address,
            "zone": loc.zone,
            "coordinates": [loc.latitude, loc.longitude],
            "total_incidents": 0,
            "verified_observations": [
                {
                    "text": f"No incidents are currently recorded for {loc.name}.",
                    "supporting_incidents": [],
                    "metrics": {"total_incidents": 0}
                }
            ],
            "plausible_hypotheses": [],
            "missing_information": [
                "No incident complaints or telemetry exist to evaluate operational root causes."
            ],
            "recommendations": []
        }

    # 1. Frequency and category distribution
    categories = [i.category for i in incidents]
    category_counts = Counter(categories)
    dominant_category, dominant_count = category_counts.most_common(1)[0]
    dominant_pct = round((dominant_count / total_incidents) * 100, 1)

    # 2. Severity distribution
    severities = [i.severity for i in incidents]
    severity_counts = Counter(severities)
    has_critical = severity_counts.get("Critical", 0) > 0
    critical_incidents = [i.id for i in incidents if i.severity == "Critical"]

    # 3. Resolution and evidence metrics
    resolved_incidents = [i for i in incidents if i.status == "Resolved — Verified"]
    open_incidents = [i for i in incidents if i.status != "Resolved — Verified"]
    incidents_with_evidence = [i for i in incidents if i.evidence and len(i.evidence) > 0]
    evidence_rate_pct = round((len(incidents_with_evidence) / total_incidents) * 100, 1)

    # 4. Post-resolution recurrence and elapsed time
    post_res_alerts = [a for a in alerts if a.is_post_resolution]
    active_cluster_alerts = [a for a in alerts if not a.is_post_resolution]

    relapse_intervals_days: List[float] = []
    relapse_pairs: List[Dict[str, Any]] = []

    for alert in post_res_alerts:
        primary = next((i for i in incidents if i.id == alert.primary_incident_id), None)
        trigger = next((i for i in incidents if i.id == alert.trigger_incident_id), None)
        
        if primary and trigger and primary.resolved_at and trigger.created_at:
            delta = trigger.created_at - primary.resolved_at
            days = round(max(0.0, delta.total_seconds() / 86400.0), 1)
            relapse_intervals_days.append(days)
            relapse_pairs.append({
                "alert_id": alert.id,
                "resolved_incident_id": primary.id,
                "resolved_at": primary.resolved_at.isoformat(),
                "recurrence_incident_id": trigger.id,
                "recurrence_at": trigger.created_at.isoformat(),
                "days_to_relapse": days
            })

    avg_days_to_relapse = round(sum(relapse_intervals_days) / len(relapse_intervals_days), 1) if relapse_intervals_days else None

    # =================================================================
    # A. VERIFIED OBSERVATIONS (Grounded in record IDs and DB metrics)
    # =================================================================
    verified_observations = []

    # Frequency and category observation
    all_inc_ids = [i.id for i in incidents]
    verified_observations.append({
        "text": f"{total_incidents} incident(s) logged at this location. Primary category is '{dominant_category}', representing {dominant_pct}% of total reports ({dominant_count}/{total_incidents}).",
        "supporting_incidents": [i.id for i in incidents if i.category == dominant_category],
        "metrics": {
            "total_incidents": total_incidents,
            "dominant_category": dominant_category,
            "dominant_percentage": dominant_pct
        }
    })

    # Recurrence pattern observation
    if len(post_res_alerts) > 0:
        verified_observations.append({
            "text": f"{len(post_res_alerts)} verified post-resolution relapse event(s) recorded within the 30-day monitoring window. Average time between certified cleanup and subsequent complaint: {avg_days_to_relapse} days.",
            "supporting_incidents": [p["recurrence_incident_id"] for p in relapse_pairs],
            "metrics": {
                "post_resolution_relapses": len(post_res_alerts),
                "mean_time_to_relapse_days": avg_days_to_relapse,
                "relapse_details": relapse_pairs
            }
        })
    elif len(active_cluster_alerts) > 0:
        verified_observations.append({
            "text": f"{len(active_cluster_alerts)} active spatial recurrence cluster alert(s) detected without certified intermediate cleanup.",
            "supporting_incidents": [a.trigger_incident_id for a in active_cluster_alerts],
            "metrics": {
                "active_cluster_alerts": len(active_cluster_alerts)
            }
        })
    else:
        verified_observations.append({
            "text": "No multi-complaint recurrence clusters or post-cleanup relapses currently detected at this site.",
            "supporting_incidents": all_inc_ids[:3],
            "metrics": {"recurrence_alerts_count": 0}
        })

    # Severity observation
    if has_critical:
        verified_observations.append({
            "text": f"Critical severity flagged on {len(critical_incidents)} incident(s) requiring urgent municipal safeguards (score >= 85 enforced).",
            "supporting_incidents": critical_incidents,
            "metrics": {"critical_count": len(critical_incidents)}
        })

    # Evidence rate observation
    verified_observations.append({
        "text": f"Photographic cleanup evidence submitted on {len(incidents_with_evidence)} of {total_incidents} reports ({evidence_rate_pct}% compliance).",
        "supporting_incidents": [i.id for i in incidents_with_evidence],
        "metrics": {"evidence_compliance_pct": evidence_rate_pct}
    })

    # =================================================================
    # B. PLAUSIBLE HYPOTHESES (Empirical interpretations with caveats)
    # =================================================================
    plausible_hypotheses = []

    if dominant_category in ["Overflowing garbage bin", "Roadside garbage accumulation"] and len(post_res_alerts) > 0:
        plausible_hypotheses.append({
            "title": "Insufficient Container Volume vs Peak Generation",
            "hypothesis": f"Because cleanup sustains cleanliness for an average of only {avg_days_to_relapse} days before overflowing again, local waste generation during peak hours exceeds available bin volume. Field sweeps clean loose debris without altering physical storage capacity.",
            "confidence": "High",
            "caveat": "Based on repeat complaint intervals. Volumetric sensor logs are required to prove peak fill-rate curves."
        })

    if dominant_category == "Drain blockage caused by waste" or has_critical:
        plausible_hypotheses.append({
            "title": "Upstream Debris Entrainment in Stormwater Culvert",
            "hypothesis": "Surface waste accumulation from surrounding pedestrian and commercial activity washes into the open drainage aperture during rain or street washdowns, causing rapid siltation and flash flood risks.",
            "confidence": "Moderate",
            "caveat": "Correlated with drain category reports. Hydrological drainage survey and upstream grate inspections are needed to confirm inflow points."
        })

    if dominant_category in ["Illegal dumping", "Construction waste"]:
        plausible_hypotheses.append({
            "title": "Unpermitted Off-Hours Commercial Disposal",
            "hypothesis": "Repeated dumping of bulk renovation debris or commercial cartons indicates third-party contractors disposing of waste overnight to bypass authorized transfer station tipping fees.",
            "confidence": "Moderate",
            "caveat": "Inferred from repeated non-domestic waste categories. Requires municipal night patrol or CCTV logs to confirm contractor identity."
        })

    if len(plausible_hypotheses) == 0:
        plausible_hypotheses.append({
            "title": "Standard Operational Variance",
            "hypothesis": "Incidents at this location appear to be isolated routine complaints rather than a systemic infrastructure breakdown.",
            "confidence": "Moderate",
            "caveat": "Based on current low recurrence density."
        })

    # =================================================================
    # C. MISSING INFORMATION (Explicitly highlighting data gaps)
    # =================================================================
    missing_information = [
        "No IoT ultrasonic bin-level telemetry is installed on containers at this location.",
        "Sanitation collection vehicle GPS route timestamps and compactor scale logs are not integrated into this system.",
        "Weighbridge discard volume records for morning vs evening shifts are unavailable in the municipal portal.",
        "Data is insufficient to definitively prove contractor service default versus sudden commercial dumping surges."
    ]

    # =================================================================
    # D. EXPLAINABLE RECOMMENDATIONS (Actionable next steps with metrics)
    # =================================================================
    recommendations = []

    if len(post_res_alerts) > 0:
        recommendations.append({
            "id": "REC-01",
            "action": "Perform physical container capacity audit & increase collection frequency",
            "rationale": f"Location relapsed {len(post_res_alerts)} times within 30 days of verified cleanup (average recurrence window: {avg_days_to_relapse} days).",
            "supporting_incidents": [p["recurrence_incident_id"] for p in relapse_pairs],
            "measurements": {
                "relapse_count": len(post_res_alerts),
                "mean_time_to_relapse_days": avg_days_to_relapse
            },
            "confidence": "High",
            "verification_needed": "Log hourly bin fill-levels manually over 72 hours before purchasing additional 1100L compactor bins."
        })

    if has_critical:
        recommendations.append({
            "id": "REC-02",
            "action": "Immediate drainage desilting & deployment of protective debris grates",
            "rationale": f"Critical drain blockage detected on incident(s) {', '.join(critical_incidents)}. Priority score enforced >= 85.",
            "supporting_incidents": critical_incidents,
            "measurements": {"critical_count": len(critical_incidents), "priority_enforced": 85.0},
            "confidence": "High",
            "verification_needed": "Verify culvert flow discharge rate with handheld gauge following clearing."
        })

    if len(open_incidents) > 0:
        recommendations.append({
            "id": "REC-03",
            "action": "Dispatch assigned response crew & establish before-cleanup photo baseline",
            "rationale": f"{len(open_incidents)} open complaint(s) currently unverified at this location.",
            "supporting_incidents": [i.id for i in open_incidents][:4],
            "measurements": {"open_incidents_count": len(open_incidents)},
            "confidence": "High",
            "verification_needed": "Field worker must upload timestamped site photograph via mobile terminal."
        })

    if len(resolved_incidents) > 0 and len(post_res_alerts) == 0:
        recommendations.append({
            "id": "REC-04",
            "action": "Maintain active 30-day post-resolution passive monitoring",
            "rationale": f"{len(resolved_incidents)} incident(s) successfully verified clean without recurrence to date.",
            "supporting_incidents": [i.id for i in resolved_incidents],
            "measurements": {"verified_count": len(resolved_incidents)},
            "confidence": "Moderate",
            "verification_needed": "Review weekly citizen reporting rates along Vikas Marg corridor."
        })

    return {
        "location_id": loc.id,
        "location_name": loc.name,
        "address": loc.address,
        "zone": loc.zone,
        "coordinates": [loc.latitude, loc.longitude],
        "total_incidents": total_incidents,
        "open_incidents_count": len(open_incidents),
        "verified_incidents_count": len(resolved_incidents),
        "post_resolution_relapse_count": len(post_res_alerts),
        "mean_time_to_relapse_days": avg_days_to_relapse,
        "dominant_category": dominant_category,
        "dominant_category_percentage": dominant_pct,
        "evidence_compliance_percentage": evidence_rate_pct,
        "verified_observations": verified_observations,
        "plausible_hypotheses": plausible_hypotheses,
        "missing_information": missing_information,
        "recommendations": recommendations,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
