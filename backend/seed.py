import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.models import Location, Incident, StatusHistory, ResolutionEvidence, RecurrenceAlert
from backend.engines.recurrence_engine import evaluate_recurrence_for_incident
from backend.engines.priority_engine import update_incident_priority

DEMO_DISCLAIMER = "DEMO DATA — Synthetic incidents at real geographic locations."

# =====================================================================
# REAL EAST DELHI DEMONSTRATION LOCATIONS
# Real coordinates anchored around Laxmi Nagar, Nirman Vihar, Preet Vihar,
# Shakarpur, Pandav Nagar, Patparganj, Swasthya Vihar, and Anand Vihar.
# =====================================================================
DEMO_LOCATIONS = [
    {
        "id": 1,
        "name": "[Demo] Laxmi Nagar Metro Station (Gate 2 Corridor)",
        "address": "Vikas Marg, Laxmi Nagar, East Delhi 110092",
        "latitude": 28.6304,
        "longitude": 77.2777,
        "zone": "East Delhi - Zone A (Vikas Marg)",
        "is_demo": True
    },
    {
        "id": 2,
        "name": "[Demo] Nirman Vihar V3S Mall Perimeter",
        "address": "Near Nirman Vihar Metro Concourse, Vikas Marg, East Delhi 110092",
        "latitude": 28.6369,
        "longitude": 77.2842,
        "zone": "East Delhi - Zone A (Vikas Marg)",
        "is_demo": True
    },
    {
        "id": 3,
        "name": "[Demo] Preet Vihar Commercial Centre (Metro Pillar 104)",
        "address": "Vikas Marg Commercial Block, Preet Vihar, East Delhi 110092",
        "latitude": 28.6416,
        "longitude": 77.2965,
        "zone": "East Delhi - Zone B (Preet Vihar)",
        "is_demo": True
    },
    {
        "id": 4,
        "name": "[Demo] Shakarpur Main Market & School Block",
        "address": "School Block Rd near Mother Teresa School, Shakarpur, East Delhi 110092",
        "latitude": 28.6258,
        "longitude": 77.2772,
        "zone": "East Delhi - Zone A (Shakarpur)",
        "is_demo": True
    },
    {
        "id": 5,
        "name": "[Demo] Pandav Nagar Stormwater Drain & Mother Dairy Road",
        "address": "Near Mother Dairy Flyover & Culvert, Pandav Nagar, East Delhi 110092",
        "latitude": 28.6200,
        "longitude": 77.2830,
        "zone": "East Delhi - Zone C (Pandav Nagar)",
        "is_demo": True
    },
    {
        "id": 6,
        "name": "[Demo] Patparganj Industrial Area Road 57 Commercial Yard",
        "address": "Road No. 57, Patparganj Industrial Area, East Delhi 110092",
        "latitude": 28.6300,
        "longitude": 77.3000,
        "zone": "East Delhi - Zone D (Industrial)",
        "is_demo": True
    },
    {
        "id": 7,
        "name": "[Demo] Swasthya Vihar Community Park Perimeter",
        "address": "Main Park Boundary Road, Swasthya Vihar, East Delhi 110092",
        "latitude": 28.6380,
        "longitude": 77.2900,
        "zone": "East Delhi - Zone B (Preet Vihar)",
        "is_demo": True
    },
    {
        "id": 8,
        "name": "[Demo] Anand Vihar ISBT & Railway Terminal Footpath",
        "address": "Inter-State Bus Terminal Concourse, Anand Vihar, East Delhi 110092",
        "latitude": 28.6470,
        "longitude": 77.3150,
        "zone": "East Delhi - Zone E (Transit Hub)",
        "is_demo": True
    }
]

def reset_database(db: Session):
    """
    Clears all DEMO records safely without deleting real user-created incidents.
    Idempotent and deterministic.
    """
    demo_incidents = db.query(Incident).filter(
        or_(Incident.is_demo == True, Incident.id.like("INC-DELHI-%"), Incident.id.like("INC-DEMO-%"))
    ).all()
    demo_ids = [i.id for i in demo_incidents]

    if demo_ids:
        # Delete alerts referencing demo incidents
        db.query(RecurrenceAlert).filter(
            or_(
                RecurrenceAlert.primary_incident_id.in_(demo_ids),
                RecurrenceAlert.trigger_incident_id.in_(demo_ids)
            )
        ).delete(synchronize_session=False)

        # Delete evidence
        db.query(ResolutionEvidence).filter(
            ResolutionEvidence.incident_id.in_(demo_ids)
        ).delete(synchronize_session=False)

        # Delete status histories
        db.query(StatusHistory).filter(
            StatusHistory.incident_id.in_(demo_ids)
        ).delete(synchronize_session=False)

        # Delete incidents
        db.query(Incident).filter(
            Incident.id.in_(demo_ids)
        ).delete(synchronize_session=False)

    # Delete demo locations only if no non-demo incidents remain linked
    demo_locs = db.query(Location).filter(
        or_(Location.is_demo == True, Location.name.like("[Demo]%"))
    ).all()
    for loc in demo_locs:
        user_inc_count = db.query(Incident).filter(
            Incident.location_id == loc.id,
            Incident.is_demo == False
        ).count()
        if user_inc_count == 0:
            db.query(RecurrenceAlert).filter(
                RecurrenceAlert.location_id == loc.id
            ).delete(synchronize_session=False)
            db.delete(loc)

    db.commit()


def seed_database(db: Session) -> int:
    """
    Seeds deterministic synthetic Delhi demonstration dataset demonstrating:
    1. First-time overflowing-bin complaint (isolated).
    2. Multiple compatible complaints near the same location (active cluster).
    3. Cleanup submitted but awaiting supervisor verification.
    4. Verified cleanup with historical evidence & active 30-day monitoring.
    5. Subsequent complaint that triggers post-resolution recurrence alert.
    6. Separate critical waste incident (culvert/drain flood hazard) with urgent safeguard.
    7. Low-priority incident.
    """
    now = datetime.now(timezone.utc)

    # 1. Reset existing demo records safely
    reset_database(db)

    # 2. Add Demonstration Locations
    locations_map = {}
    for loc_data in DEMO_LOCATIONS:
        existing_loc = db.query(Location).filter(Location.id == loc_data["id"]).first()
        if existing_loc:
            for k, v in loc_data.items():
                setattr(existing_loc, k, v)
            locations_map[existing_loc.id] = existing_loc
        else:
            loc = Location(**loc_data)
            db.add(loc)
            db.flush()
            locations_map[loc.id] = loc

    # 3. Define 25 synthetic realistic incidents across Delhi locations
    # (Notice: coordinate perturbations are <= 25 meters from location center)
    raw_incidents = [
        # -------------------------------------------------------------
        # SCENARIO 5: LAXMI NAGAR METRO (POST-RESOLUTION RECURRENCE RELAPSE)
        # Incident 1 was verified resolved 12 days ago with full evidence.
        # Incident 2 is reported 2 days ago at the same spot -> Post-Resolution Recurrence Alert!
        # Incident 3 is another recent complaint on the corridor.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-001",
            "location_id": 1,
            "title": "[DEMO DATA] Severe bin overflow at Laxmi Nagar Metro Gate 2",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Heavy commercial packaging and food boxes overflowed onto Vikas Marg pedestrian walkway.",
            "severity": "High",
            "latitude": 28.6304,
            "longitude": 77.2777,
            "address_text": "Vikas Marg, Laxmi Nagar Metro Gate 2, East Delhi",
            "status": "Resolved — Verified",
            "days_ago": 16,
            "resolved_days_ago": 12,
            "has_evidence": True,
            "evidence_verified": True
        },
        {
            "id": "INC-DELHI-002",
            "location_id": 1,
            "title": "[DEMO DATA] Recurring waste pileup at Laxmi Nagar Metro Gate 2",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Same location developed severe overflow again only 10 days after verified municipal cleanup.",
            "severity": "High",
            "latitude": 28.6304,
            "longitude": 77.2777,
            "address_text": "Vikas Marg, Laxmi Nagar Metro Gate 2, East Delhi",
            "status": "Recurrence Detected",
            "days_ago": 2,
            "resolved_days_ago": None,
            "has_evidence": True,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-003",
            "location_id": 1,
            "title": "[DEMO DATA] Street food cartons spilling near Laxmi Nagar subway",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Street food disposable plates and plastic wrapping piled near metro underpass exit.",
            "severity": "Medium",
            "latitude": 28.6305,
            "longitude": 77.2778,
            "address_text": "Pedestrian subway stairs, Laxmi Nagar Metro, Vikas Marg",
            "status": "Assigned",
            "days_ago": 1,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },

        # -------------------------------------------------------------
        # SCENARIO 2: NIRMAN VIHAR V3S MALL (ACTIVE COMPATIBLE CLUSTER)
        # Multiple compatible complaints near same location without closure.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-004",
            "location_id": 2,
            "title": "[DEMO DATA] Commercial cardboard accumulation near V3S Mall rear gate",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Uncollected retail packaging and dry carton stacks obstructing delivery lane.",
            "severity": "Medium",
            "latitude": 28.6369,
            "longitude": 77.2842,
            "address_text": "V3S Mall Service Road, Nirman Vihar, East Delhi",
            "status": "Assigned",
            "days_ago": 4,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-005",
            "location_id": 2,
            "title": "[DEMO DATA] Food court waste bin overflow near Nirman Vihar Concourse",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Overflowing compactor bin 20 meters from V3S Mall delivery gate, creating foul odor.",
            "severity": "High",
            "latitude": 28.6370,
            "longitude": 77.2843,
            "address_text": "Near V3S Mall East Gate, Nirman Vihar, East Delhi",
            "status": "Reported",
            "days_ago": 1,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-006",
            "location_id": 2,
            "title": "[DEMO DATA] Missed night garbage collection at Nirman Vihar market line",
            "category": "Missed garbage collection",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Sanitation collection truck missed scheduled morning sweep along retail lane.",
            "severity": "Medium",
            "latitude": 28.6368,
            "longitude": 77.2841,
            "address_text": "Retail lane opposite V3S Mall, Nirman Vihar",
            "status": "Reported",
            "days_ago": 1,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },

        # -------------------------------------------------------------
        # SCENARIO 3: PREET VIHAR COMMERCIAL CENTRE (CLEANUP SUBMITTED, AWAITING VERIFICATION)
        # Field worker uploaded after-cleanup evidence; supervisor review pending.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-007",
            "location_id": 3,
            "title": "[DEMO DATA] High-volume market waste pileup at Preet Vihar Pillar 104",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Large accumulation of commercial polythene and grocery cartons. Cleanup completed, awaiting audit.",
            "severity": "High",
            "latitude": 28.6416,
            "longitude": 77.2965,
            "address_text": "Metro Pillar 104, Vikas Marg, Preet Vihar, East Delhi",
            "status": "Verification Pending",
            "days_ago": 3,
            "resolved_days_ago": None,
            "has_evidence": True,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-008",
            "location_id": 3,
            "title": "[DEMO DATA] Construction debris on pedestrian walkway near Preet Vihar",
            "category": "Construction waste",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Bags of dry plaster and broken brick rubble deposited along commercial arcade.",
            "severity": "Medium",
            "latitude": 28.6418,
            "longitude": 77.2968,
            "address_text": "Commercial Arcade Lane 2, Preet Vihar, East Delhi",
            "status": "Cleanup Submitted",
            "days_ago": 2,
            "resolved_days_ago": None,
            "has_evidence": True,
            "evidence_verified": False
        },

        # -------------------------------------------------------------
        # SCENARIO 4: PATPARGANJ INDUSTRIAL AREA (VERIFIED RESOLUTION WITH 30-DAY MONITORING)
        # Cleaned and verified by supervisor; under active 30-day follow-up.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-009",
            "location_id": 6,
            "title": "[DEMO DATA] Industrial packaging waste on Road 57 Patparganj",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Pallet wraps and scrap foam cleared and safely transported to processing facility.",
            "severity": "Medium",
            "latitude": 28.6300,
            "longitude": 77.3000,
            "address_text": "Road No. 57, Patparganj Industrial Area, East Delhi",
            "status": "Resolved — Verified",
            "days_ago": 7,
            "resolved_days_ago": 5,
            "has_evidence": True,
            "evidence_verified": True
        },
        {
            "id": "INC-DELHI-010",
            "location_id": 6,
            "title": "[DEMO DATA] Scrap metal and drum dumping on Patparganj corner",
            "category": "Illegal dumping",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Unauthorized industrial scrap removed by environmental team.",
            "severity": "High",
            "latitude": 28.6301,
            "longitude": 77.3002,
            "address_text": "Road 57 Corner Yard, Patparganj Industrial Area",
            "status": "Resolved — Verified",
            "days_ago": 18,
            "resolved_days_ago": 15,
            "has_evidence": True,
            "evidence_verified": True
        },

        # -------------------------------------------------------------
        # SCENARIO 6: PANDAV NAGAR STORMWATER DRAIN (CRITICAL INCIDENT WITH SAFEGUARD)
        # Culvert blockage with flood risk -> Critical severity, score >= 85 enforced.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-011",
            "location_id": 5,
            "title": "[DEMO DATA] Major culvert drain blockage near Mother Dairy Flyover",
            "category": "Drain blockage caused by waste",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Stormwater discharge canal choked by dense plastic and silt. Immediate flash flood hazard.",
            "severity": "Critical",
            "latitude": 28.6200,
            "longitude": 77.2830,
            "address_text": "Near Mother Dairy Flyover Culvert, Pandav Nagar, East Delhi",
            "status": "Reported",
            "days_ago": 1,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-012",
            "location_id": 5,
            "title": "[DEMO DATA] Recurring culvert siltation & plastic accumulation",
            "category": "Drain blockage caused by waste",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Prior culvert clearing was overwhelmed by upstream waste influx.",
            "severity": "Critical",
            "latitude": 28.6201,
            "longitude": 77.2831,
            "address_text": "Mother Dairy Drain Outfall, Pandav Nagar, East Delhi",
            "status": "Assigned",
            "days_ago": 5,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },

        # -------------------------------------------------------------
        # SCENARIO 1: SWASTHYA VIHAR COMMUNITY PARK (FIRST-TIME ISOLATED COMPLAINT)
        # Single isolated complaint, zero historical recurrence.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-013",
            "location_id": 7,
            "title": "[DEMO DATA] Overflowing litter bin at Swasthya Vihar Park Gate",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Public pedestrian litter bin near main jogging track full of snack wrappers.",
            "severity": "Low",
            "latitude": 28.6380,
            "longitude": 77.2900,
            "address_text": "Swasthya Vihar Main Park Gate, East Delhi",
            "status": "Reported",
            "days_ago": 1,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },

        # -------------------------------------------------------------
        # SCENARIO 7: ANAND VIHAR TRANSIT CONCOURSE (LOW-PRIORITY INCIDENT)
        # Minor dry leaf & paper litter along concourse.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-014",
            "location_id": 8,
            "title": "[DEMO DATA] Paper and dry leaf litter on Anand Vihar concourse footpath",
            "category": "Other waste-related issue",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Light paper flyers and fallen leaves along the outer footway.",
            "severity": "Low",
            "latitude": 28.6470,
            "longitude": 77.3150,
            "address_text": "Outer Pedestrian Concourse, Anand Vihar ISBT, East Delhi",
            "status": "Reported",
            "days_ago": 2,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },

        # -------------------------------------------------------------
        # SHAKARPUR MAIN MARKET (CHRONIC URBAN MARKET BOTTLENECK)
        # Multiple historical recurrences to demonstrate heatmaps & analytics.
        # -------------------------------------------------------------
        {
            "id": "INC-DELHI-015",
            "location_id": 4,
            "title": "[DEMO DATA] Vegetable market residue in Shakarpur School Block lane",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Decaying organic produce and packing straw left after evening vegetable bazaar.",
            "severity": "High",
            "latitude": 28.6258,
            "longitude": 77.2772,
            "address_text": "School Block Rd, Shakarpur Main Market, East Delhi",
            "status": "Resolved — Verified",
            "days_ago": 24,
            "resolved_days_ago": 21,
            "has_evidence": True,
            "evidence_verified": True
        },
        {
            "id": "INC-DELHI-016",
            "location_id": 4,
            "title": "[DEMO DATA] Post-cleanup relapse at Shakarpur vegetable market",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Organic waste dumped again at exactly the same corner within 10 days of verified cleanup.",
            "severity": "High",
            "latitude": 28.6258,
            "longitude": 77.2772,
            "address_text": "School Block Rd, Shakarpur Main Market, East Delhi",
            "status": "Recurrence Detected",
            "days_ago": 10,
            "resolved_days_ago": None,
            "has_evidence": True,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-017",
            "location_id": 4,
            "title": "[DEMO DATA] Third overflow relapse at Shakarpur School Block corner",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Chronic repeat failure. Market vendor stalls dumping outside small 240L bins.",
            "severity": "High",
            "latitude": 28.6259,
            "longitude": 77.2773,
            "address_text": "School Block Market Junction, Shakarpur, East Delhi",
            "status": "Assigned",
            "days_ago": 2,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },

        # Additional historical context records for time-series charts
        {
            "id": "INC-DELHI-018",
            "location_id": 8,
            "title": "[DEMO DATA] Commercial plastic accumulation near Anand Vihar Bus Bay 3",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Water bottles and snack packaging left in transit loading bays.",
            "severity": "Medium",
            "latitude": 28.6472,
            "longitude": 77.3152,
            "address_text": "Bus Bay 3 Platform, Anand Vihar ISBT, East Delhi",
            "status": "Resolved — Verified",
            "days_ago": 14,
            "resolved_days_ago": 11,
            "has_evidence": True,
            "evidence_verified": True
        },
        {
            "id": "INC-DELHI-019",
            "location_id": 8,
            "title": "[DEMO DATA] Waste overflow at Anand Vihar commuter concourse",
            "category": "Overflowing garbage bin",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] High commuter traffic caused rapid overflow of concourse bins.",
            "severity": "Medium",
            "latitude": 28.6471,
            "longitude": 77.3151,
            "address_text": "Commuter Footbridge, Anand Vihar ISBT",
            "status": "Reported",
            "days_ago": 3,
            "resolved_days_ago": None,
            "has_evidence": False,
            "evidence_verified": False
        },
        {
            "id": "INC-DELHI-020",
            "location_id": 3,
            "title": "[DEMO DATA] Commercial food discard near Preet Vihar restaurant lane",
            "category": "Roadside garbage accumulation",
            "description": "[DEMO DATA — Synthetic incident at real geographic location] Night kitchen waste bags left uncollected along service road.",
            "severity": "Medium",
            "latitude": 28.6415,
            "longitude": 77.2964,
            "address_text": "Commercial Block C Rear Lane, Preet Vihar",
            "status": "Resolved — Verified",
            "days_ago": 26,
            "resolved_days_ago": 24,
            "has_evidence": True,
            "evidence_verified": True
        }
    ]

    created_incidents = []

    # Sort chronologically by days_ago descending (oldest reports evaluated first)
    raw_incidents.sort(key=lambda x: x["days_ago"], reverse=True)

    for item in raw_incidents:
        created_time = now - timedelta(days=item["days_ago"])
        resolved_time = (now - timedelta(days=item["resolved_days_ago"])) if item["resolved_days_ago"] else None

        inc = Incident(
            id=item["id"],
            location_id=item["location_id"],
            title=item["title"],
            category=item["category"],
            description=item["description"],
            severity=item["severity"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            address_text=item["address_text"],
            status=item["status"],
            is_anonymous=False,
            is_demo=True,
            image_url="/uploads/demo_waste_before.jpg",
            created_at=created_time,
            resolved_at=resolved_time,
            assigned_to="East Delhi Sanitation Unit 4" if item["status"] in ["Assigned", "Cleanup Submitted", "Verification Pending", "Resolved — Verified"] else None
        )
        db.add(inc)
        db.flush()

        # Add initial StatusHistory
        h1 = StatusHistory(
            incident_id=inc.id,
            from_status="None",
            to_status="Reported",
            changed_by_role="Citizen",
            notes="Demonstration incident report registered at real geographic coordinates.",
            created_at=created_time
        )
        db.add(h1)

        if inc.status != "Reported":
            h2 = StatusHistory(
                incident_id=inc.id,
                from_status="Reported",
                to_status=inc.status,
                changed_by_role="Supervisor",
                notes=f"Status transitioned to '{inc.status}' during municipal triage.",
                created_at=created_time + timedelta(hours=2)
            )
            db.add(h2)

        # Add evidence if applicable
        if item["has_evidence"]:
            ev = ResolutionEvidence(
                incident_id=inc.id,
                submitted_by_role="Field Worker",
                image_url="/uploads/demo_waste_evidence.jpg",
                notes="Cleanup photo submitted by field worker via handheld terminal.",
                cleanup_timestamp=created_time + timedelta(hours=3),
                is_verified=item["evidence_verified"],
                verified_by_role="Supervisor" if item["evidence_verified"] else None,
                verified_at=resolved_time if item["evidence_verified"] else None,
                created_at=created_time + timedelta(hours=3)
            )
            db.add(ev)

        # Evaluate recurrence against previous incidents in database
        evaluate_recurrence_for_incident(db, inc)

        # Update explainable priority scoring
        is_post_res = (inc.status == "Recurrence Detected")
        update_incident_priority(inc, is_post_resolution=is_post_res, now=now)

        created_incidents.append(inc)

    db.commit()
    return len(created_incidents)
