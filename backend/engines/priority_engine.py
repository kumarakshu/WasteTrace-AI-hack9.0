import json
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from backend.models import Incident
from backend.config import settings

SEVERITY_SCORES = {
    "Critical": 100.0,
    "High": 75.0,
    "Medium": 50.0,
    "Low": 25.0
}

def calculate_priority_score(
    incident: Incident,
    is_post_resolution: bool = False,
    now: datetime = None
) -> Tuple[float, str, Dict[str, Any]]:
    """
    Explainable priority scoring engine based on:
    - Severity: 40%
    - Recurrence frequency: 30%
    - Unresolved duration: 20%
    - Evidence confidence: 10%

    Includes an explicit urgent safeguard for Critical severity.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # 1. Severity Score (0-100)
    sev_score = SEVERITY_SCORES.get(incident.severity, 25.0)

    # 2. Recurrence Score (0-100)
    r_count = incident.recurrence_count or 0
    if r_count == 0:
        rec_score = 0.0
    elif r_count == 1:
        rec_score = 40.0
    elif r_count == 2:
        rec_score = 70.0
    else:
        rec_score = 100.0

    if is_post_resolution:
        rec_score = min(100.0, rec_score + 25.0)

    # 3. Unresolved Duration Score (0-100)
    # If already resolved, duration score is 0
    if incident.status in ("Resolved — Verified",):
        dur_score = 0.0
        hours_unresolved = 0.0
    else:
        created_time = incident.created_at
        if created_time.tzinfo is None:
            created_time = created_time.replace(tzinfo=timezone.utc)
        
        hours_unresolved = max(0.0, (now - created_time).total_seconds() / 3600.0)
        # Scaled so 72 hours (3 days) unresolved equals 100 max score
        dur_score = min(100.0, (hours_unresolved / 72.0) * 100.0)

    # 4. Evidence Confidence Score (0-100)
    # Handle missing evidence without silently treating it as strong evidence
    has_image = bool(incident.image_url and incident.image_url.strip())
    has_verified_evidence = False
    if incident.evidence:
        for ev in incident.evidence:
            if ev.is_verified:
                has_verified_evidence = True
                break

    if has_verified_evidence:
        ev_score = 90.0
        ev_label = "Verified Cleanup/Photo Evidence"
    elif has_image:
        ev_score = 65.0
        ev_label = "Unverified Citizen Photo Evidence"
    else:
        ev_score = 20.0
        ev_label = "No Photographic Evidence (Text Only)"

    # Weighted calculation
    w_sev = settings.WEIGHT_SEVERITY
    w_rec = settings.WEIGHT_RECURRENCE
    w_dur = settings.WEIGHT_DURATION
    w_ev = settings.WEIGHT_EVIDENCE

    raw_score = (
        (sev_score * w_sev) +
        (rec_score * w_rec) +
        (dur_score * w_dur) +
        (ev_score * w_ev)
    )

    # Explicit urgent safeguard for Critical severity
    urgent_safeguard_triggered = False
    final_score = raw_score
    if incident.severity == "Critical" and final_score < 85.0:
        final_score = 85.0
        urgent_safeguard_triggered = True

    final_score = round(min(100.0, max(0.0, final_score)), 1)

    # Determine priority level
    if final_score >= 80.0:
        level = "Critical"
    elif final_score >= 60.0:
        level = "High"
    elif final_score >= 40.0:
        level = "Medium"
    else:
        level = "Low"

    # Action recommendation
    if level == "Critical":
        action = "Immediate sanitation dispatch and supervisor site inspection required within 2 hours."
    elif level == "High":
        action = "Schedule prioritized collection team within next dispatch shift (4-6 hours)."
    elif level == "Medium":
        action = "Queue for standard municipal maintenance route."
    else:
        action = "Monitor location and review on next scheduled route."

    explanation_factors = []
    if incident.severity == "Critical":
        explanation_factors.append("Critical biohazard/blocking severity")
    elif incident.severity == "High":
        explanation_factors.append("High severity waste hazard")

    if is_post_resolution:
        explanation_factors.append("Critical recurrence after previous verified resolution")
    elif r_count > 0:
        explanation_factors.append(f"{r_count} recurring incidents detected at location")

    if hours_unresolved > 48:
        explanation_factors.append(f"Unresolved for {round(hours_unresolved, 1)} hours")

    if urgent_safeguard_triggered:
        explanation_factors.append("Urgent-review safeguard enforced (guaranteed priority >= 85)")

    breakdown = {
        "final_score": final_score,
        "priority_level": level,
        "severity_score": sev_score,
        "severity_weight": w_sev,
        "recurrence_score": rec_score,
        "recurrence_weight": w_rec,
        "duration_score": round(dur_score, 1),
        "duration_weight": w_dur,
        "duration_hours": round(hours_unresolved, 1),
        "evidence_score": ev_score,
        "evidence_weight": w_ev,
        "evidence_label": ev_label,
        "urgent_safeguard_active": urgent_safeguard_triggered,
        "factors_summary": explanation_factors,
        "suggested_next_action": action
    }

    return final_score, level, breakdown

def update_incident_priority(incident: Incident, is_post_resolution: bool = False, now: datetime = None):
    score, level, breakdown = calculate_priority_score(incident, is_post_resolution=is_post_resolution, now=now)
    incident.priority_score = score
    incident.priority_level = level
    incident.priority_breakdown = json.dumps(breakdown)
