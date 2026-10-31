import math
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from backend.models import Incident, RecurrenceAlert, Location

# Earth's radius in meters
EARTH_RADIUS_METERS = 6371000.0

def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def is_valid_coordinate(lat: Optional[float], lon: Optional[float]) -> bool:
    if lat is None or lon is None:
        return False
    if math.isnan(lat) or math.isnan(lon):
        return False
    # Avoid treating default (0, 0) as a valid urban location
    if abs(lat) < 0.0001 and abs(lon) < 0.0001:
        return False
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return False
    return True

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in meters between two coordinates on earth.
    """
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_METERS * c

CATEGORY_GROUPS = {
    "ACCUMULATION": [
        "Overflowing garbage bin",
        "Roadside garbage accumulation",
        "Missed garbage collection"
    ],
    "DUMPING": [
        "Illegal dumping",
        "Construction waste"
    ],
    "DRAINAGE": [
        "Drain blockage caused by waste"
    ],
    "OTHER": [
        "Other waste-related issue"
    ]
}

def are_categories_compatible(cat1: str, cat2: str) -> bool:
    if not cat1 or not cat2:
        return False
    if cat1.strip().lower() == cat2.strip().lower():
        return True
    for group_members in CATEGORY_GROUPS.values():
        if cat1 in group_members and cat2 in group_members:
            return True
    return False

def resolve_or_create_location(
    db: Session,
    latitude: float,
    longitude: float,
    address_text: str,
    name: Optional[str] = None,
    max_link_distance_meters: float = 80.0
) -> int:
    """
    Ensures an incident is always mapped to a persistent Location.
    Finds the nearest existing location within 80m, or creates a new one.
    """
    if is_valid_coordinate(latitude, longitude):
        locations = db.query(Location).all()
        nearest_loc = None
        min_dist = float("inf")

        for loc in locations:
            dist = haversine_distance(latitude, longitude, loc.latitude, loc.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest_loc = loc

        if nearest_loc and min_dist <= max_link_distance_meters:
            return nearest_loc.id

    # Create new location
    loc_name = name or address_text[:50] or f"Site at {latitude:.4f}, {longitude:.4f}"
    new_loc = Location(
        name=loc_name,
        address=address_text or "Unspecified Municipal Sector",
        latitude=latitude if is_valid_coordinate(latitude, longitude) else 40.7128,
        longitude=longitude if is_valid_coordinate(latitude, longitude) else -74.0060,
        zone="Central District",
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_loc)
    db.flush()
    return new_loc.id

def evaluate_recurrence_for_incident(
    db: Session,
    incident: Incident,
    radius_meters: float = 50.0,
    window_days: int = 14,
    follow_up_days: int = 30
) -> List[RecurrenceAlert]:
    """
    Deterministic recurrence-detection engine.
    1. Distinguishes active repeated complaints from post-resolution recurrence.
    2. Groups compatible waste categories.
    3. Prevents duplicate alerts and preserves full incident history.
    4. Explains exact detection rules and distances.
    """
    new_alerts: List[RecurrenceAlert] = []
    
    # Boundary check: Spatial recurrence strictly requires valid coordinates
    if not is_valid_coordinate(incident.latitude, incident.longitude):
        return []

    inc_created = to_utc(incident.created_at)
    max_days = max(window_days, follow_up_days)
    cutoff_date = inc_created - timedelta(days=max_days)

    # Search candidates created on or before current incident within max_days
    candidates = db.query(Incident).filter(
        Incident.id != incident.id,
        Incident.created_at >= cutoff_date,
        Incident.created_at <= inc_created
    ).all()

    matched_incidents: List[Tuple[Incident, float, bool, str]] = [] # (inc, dist, is_post_res, rationale)

    for cand in candidates:
        cand_created = to_utc(cand.created_at)

        # Candidate must also have valid coordinates
        if not is_valid_coordinate(cand.latitude, cand.longitude):
            continue

        # Exact geodesic Haversine distance
        dist = haversine_distance(incident.latitude, incident.longitude, cand.latitude, cand.longitude)
        if dist > radius_meters:
            continue

        # Category compatibility check
        if not are_categories_compatible(incident.category, cand.category):
            continue

        days_apart = round(abs((inc_created - cand_created).total_seconds()) / 86400.0, 1)

        # Case 1: Post-Resolution Recurrence
        # Cand was verified resolved, and new incident occurred within follow_up_days of resolution!
        if cand.status == "Resolved — Verified":
            resolved_dt = to_utc(cand.resolved_at or cand.updated_at or cand.created_at)
            time_since_res = (inc_created - resolved_dt).total_seconds() / 86400.0
            if 0.0 <= time_since_res <= float(follow_up_days):
                rationale = (
                    f"Post-Resolution Recurrence: Incident {cand.id} was marked 'Resolved — Verified' "
                    f"at this location on {resolved_dt.strftime('%Y-%m-%d')}. A subsequent compatible "
                    f"issue ({incident.category}) recurred {round(time_since_res, 1)} days later "
                    f"(monitoring threshold: {follow_up_days}d). Distance: {round(dist, 1)}m."
                )
                matched_incidents.append((cand, dist, True, rationale))
            # If resolved longer ago than follow_up_days, it does NOT trigger an alert
            continue

        # Case 2: Active Unresolved Recurrence Cluster (Repeated Complaints / Escalation)
        if days_apart <= float(window_days):
            rationale = (
                f"Active Recurrence Cluster: Incident {cand.id} ({cand.category}, status: {cand.status}) "
                f"was reported {days_apart} days prior within {round(dist, 1)}m (threshold: {radius_meters}m). "
                f"Represents ongoing unmitigated waste accumulation."
            )
            matched_incidents.append((cand, dist, False, rationale))

    if not matched_incidents:
        return new_alerts

    # Recurrence detected!
    incident.is_recurring = True
    incident.recurrence_count = max(incident.recurrence_count or 0, len(matched_incidents))

    has_post_res = any(item[2] for item in matched_incidents)
    if has_post_res and incident.status in ("Reported", "Assigned"):
        incident.status = "Recurrence Detected"

    for cand, dist, is_post_res, rationale in matched_incidents:
        # Check if an alert already exists between this pair
        existing = db.query(RecurrenceAlert).filter(
            or_(
                and_(RecurrenceAlert.primary_incident_id == cand.id, RecurrenceAlert.trigger_incident_id == incident.id),
                and_(RecurrenceAlert.primary_incident_id == incident.id, RecurrenceAlert.trigger_incident_id == cand.id)
            )
        ).first()

        if existing:
            continue

        rule_name = "RECURRENCE_AFTER_RESOLUTION" if is_post_res else "RECURRENT_PROXIMITY_CLUSTER"

        alert = RecurrenceAlert(
            location_id=incident.location_id or cand.location_id,
            primary_incident_id=cand.id,
            trigger_incident_id=incident.id,
            category=incident.category,
            distance_meters=round(dist, 1),
            incident_count=len(matched_incidents) + 1,
            rule_triggered=rule_name,
            explanation=rationale,
            is_post_resolution=is_post_res,
            created_at=datetime.now(timezone.utc)
        )
        db.add(alert)
        new_alerts.append(alert)

    # Also update candidate is_recurring flag and recurrence count
    for cand, _, _, _ in matched_incidents:
        cand.is_recurring = True
        cand.recurrence_count = max(cand.recurrence_count or 0, len(matched_incidents))

    return new_alerts
