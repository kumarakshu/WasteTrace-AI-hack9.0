import os
import pytest
os.environ["TESTING"] = "1"
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import Location, Incident, StatusHistory, ResolutionEvidence, RecurrenceAlert
from backend.engines.recurrence_engine import (
    haversine_distance, are_categories_compatible, evaluate_recurrence_for_incident,
    is_valid_coordinate, resolve_or_create_location
)
from backend.engines.priority_engine import calculate_priority_score
from backend.services.ai_service import generate_actionable_insights
from backend.services.agent_service import (
    tool_get_recurring_hotspots,
    tool_get_location_history,
    tool_get_priority_breakdown,
    tool_get_pending_resolution_reviews,
    run_agent_operational_audit
)
from backend.seed import reset_database, seed_database

# Use an in-memory SQLite database with StaticPool for testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_haversine_distance():
    # Exactly same coordinates
    assert haversine_distance(40.7128, -74.0060, 40.7128, -74.0060) == 0.0
    # Two points ~111 meters apart in latitude (0.001 deg lat ~ 111m)
    d = haversine_distance(40.7128, -74.0060, 40.7138, -74.0060)
    assert 110.0 < d < 112.0


def test_category_compatibility():
    assert are_categories_compatible("Overflowing garbage bin", "Roadside garbage accumulation") is True
    assert are_categories_compatible("Illegal dumping", "Construction waste") is True
    assert are_categories_compatible("Drain blockage caused by waste", "Overflowing garbage bin") is False
    assert are_categories_compatible("Other waste-related issue", "Other waste-related issue") is True


def test_explainable_priority_scoring_and_safeguard():
    now = datetime.now(timezone.utc)
    
    # 1. Low severity, no recurrence, fresh report, no photo
    inc_low = Incident(
        id="TEST-001",
        title="Small litter",
        category="Other waste-related issue",
        severity="Low",
        status="Reported",
        created_at=now,
        recurrence_count=0,
        image_url=None
    )
    score, level, breakdown = calculate_priority_score(inc_low, is_post_resolution=False, now=now)
    # Severity=25*0.4(10), Recurrence=0*0.3(0), Duration=0*0.2(0), Evidence=20*0.1(2) -> 12.0
    assert score == 12.0
    assert level == "Low"
    assert breakdown["urgent_safeguard_active"] is False

    # 2. Critical severity with safeguard
    inc_crit = Incident(
        id="TEST-002",
        title="Culvert blockage flood hazard",
        category="Drain blockage caused by waste",
        severity="Critical",
        status="Reported",
        created_at=now,
        recurrence_count=0,
        image_url=None
    )
    score_crit, level_crit, breakdown_crit = calculate_priority_score(inc_crit, is_post_resolution=False, now=now)
    # Even if raw score is around 42, critical safeguard must enforce >= 85.0
    assert score_crit >= 85.0
    assert level_crit == "Critical"
    assert breakdown_crit["urgent_safeguard_active"] is True


def test_recurrence_detection_and_post_resolution(db_session):
    now = datetime.now(timezone.utc)

    # Location 1
    loc = Location(
        id=1,
        name="Test Plaza",
        address="100 Main St",
        latitude=40.7128,
        longitude=-74.0060,
        zone="Central"
    )
    db_session.add(loc)
    db_session.commit()

    # Incident 1: Resolved 10 days ago
    inc1 = Incident(
        id="INC-T-001",
        location_id=1,
        title="Bin overflow",
        category="Overflowing garbage bin",
        description="First overflow incident",
        severity="High",
        latitude=40.7128,
        longitude=-74.0060,
        address_text="100 Main St",
        status="Resolved — Verified",
        created_at=now - timedelta(days=15),
        resolved_at=now - timedelta(days=10)
    )
    db_session.add(inc1)
    db_session.commit()

    # Incident 2: Reported today at same location!
    inc2 = Incident(
        id="INC-T-002",
        location_id=1,
        title="Bin overflow again",
        category="Overflowing garbage bin",
        description="Second overflow incident after resolution",
        severity="High",
        latitude=40.7128,
        longitude=-74.0060,
        address_text="100 Main St",
        status="Reported",
        created_at=now
    )
    db_session.add(inc2)
    db_session.commit()

    # Evaluate recurrence
    alerts = evaluate_recurrence_for_incident(db_session, inc2, radius_meters=50.0, window_days=14, follow_up_days=30)
    db_session.commit()

    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.is_post_resolution is True
    assert alert.rule_triggered == "RECURRENCE_AFTER_RESOLUTION"
    assert inc2.status == "Recurrence Detected"
    assert inc2.is_recurring is True
    assert inc2.recurrence_count == 1

    # Verify duplicate prevention: calling again produces 0 new alerts
    second_eval = evaluate_recurrence_for_incident(db_session, inc2)
    assert len(second_eval) == 0


def test_api_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "WasteTrace AI"


def test_api_create_incident(client, db_session):
    payload = {
        "title": "Roadside litter accumulation",
        "category": "Roadside garbage accumulation",
        "description": "Bags piled next to lamppost",
        "severity": "Medium",
        "latitude": 40.7140,
        "longitude": -74.0050,
        "address_text": "55 Broadway",
        "is_anonymous": False
    }
    res = client.post("/api/v1/incidents", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == payload["title"]
    assert data["status"] == "Reported"
    assert "priority_score" in data
    assert "priority_breakdown" in data
    assert data["priority_breakdown"]["priority_level"] in ["Low", "Medium", "High", "Critical"]


def test_api_resolution_workflow(client, db_session):
    # 1. Create incident
    payload = {
        "title": "Overflowing bin",
        "category": "Overflowing garbage bin",
        "description": "Bin overflowing",
        "severity": "High",
        "latitude": 40.7140,
        "longitude": -74.0050,
        "address_text": "55 Broadway",
        "is_anonymous": False
    }
    create_res = client.post("/api/v1/incidents", json=payload)
    inc_id = create_res.json()["id"]

    # 2. Assign incident
    status_res = client.post(f"/api/v1/incidents/{inc_id}/status", json={
        "to_status": "Assigned",
        "role": "Supervisor",
        "assigned_to": "Team Alpha"
    })
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "Assigned"
    assert status_res.json()["assigned_to"] == "Team Alpha"

    # 3. Field Worker submits cleanup evidence
    ev_res = client.post(f"/api/v1/incidents/{inc_id}/evidence", json={
        "role": "Field Worker",
        "notes": "Completed manual collection and washed sidewalk.",
        "image_url": "/uploads/test_cleanup.jpg"
    })
    assert ev_res.status_code == 200
    assert ev_res.json()["status"] == "Verification Pending"

    # 4. Supervisor verifies resolution
    verify_res = client.post(f"/api/v1/incidents/{inc_id}/verify", json={
        "approved": True,
        "role": "Supervisor",
        "notes": "Verified clean via photographic evidence."
    })
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "Resolved — Verified"
    assert verify_res.json()["resolved_at"] is not None


def test_api_insights(client, db_session):
    res = client.get("/api/v1/ai/insights")
    assert res.status_code == 200
    insights = res.json()
    assert isinstance(insights, list)
    assert len(insights) > 0
    assert "pattern" in insights[0]
    assert "suggested_action" in insights[0]


def test_coordinate_validation_and_location_resolution(db_session):
    # 1. Coordinate validation edge cases
    assert is_valid_coordinate(40.7128, -74.0060) is True
    assert is_valid_coordinate(None, -74.0060) is False
    assert is_valid_coordinate(40.7128, None) is False
    assert is_valid_coordinate(0.0, 0.0) is False  # Null island
    assert is_valid_coordinate(95.0, 10.0) is False  # Latitude out of bounds
    assert is_valid_coordinate(10.0, 200.0) is False  # Longitude out of bounds
    assert is_valid_coordinate(float('nan'), 10.0) is False

    # 2. Location resolution
    # First location should create a new record
    loc1_id = resolve_or_create_location(db_session, 40.7128, -74.0060, "100 Broadway", "Broadway Hub")
    assert loc1_id is not None
    loc1 = db_session.query(Location).filter(Location.id == loc1_id).first()
    assert loc1.name == "Broadway Hub"

    # Second location within 50m (approx 0.0002 deg lat ~ 22m) should resolve to existing loc1
    loc2_id = resolve_or_create_location(db_session, 40.7130, -74.0060, "102 Broadway")
    assert loc2_id == loc1_id

    # Third location far away (e.g., 2km away) should create a new location
    loc3_id = resolve_or_create_location(db_session, 40.7300, -74.0060, "Faraway Square")
    assert loc3_id != loc1_id


def test_recurrence_boundary_window(db_session):
    now = datetime.now(timezone.utc)
    loc = Location(id=99, name="Boundary Test Park", address="99 Boundary Rd", latitude=40.7500, longitude=-73.9900, zone="North")
    db_session.add(loc)
    db_session.commit()

    # Incident resolved 45 days ago (outside 30-day follow-up window)
    inc_old = Incident(
        id="INC-OLD-01",
        location_id=99,
        title="Old accumulation",
        category="Roadside garbage accumulation",
        description="Cleaned up long ago",
        severity="Medium",
        latitude=40.7500,
        longitude=-73.9900,
        address_text="99 Boundary Rd",
        status="Resolved — Verified",
        created_at=now - timedelta(days=50),
        resolved_at=now - timedelta(days=45)
    )
    db_session.add(inc_old)
    db_session.commit()

    # New incident today
    inc_new = Incident(
        id="INC-NEW-01",
        location_id=99,
        title="New accumulation",
        category="Roadside garbage accumulation",
        description="New accumulation today",
        severity="Medium",
        latitude=40.7500,
        longitude=-73.9900,
        address_text="99 Boundary Rd",
        status="Reported",
        created_at=now
    )
    db_session.add(inc_new)
    db_session.commit()

    # Evaluating recurrence with follow_up_days=30 must NOT link to the 45-day-old incident
    alerts = evaluate_recurrence_for_incident(db_session, inc_new, radius_meters=50.0, window_days=14, follow_up_days=30)
    assert len(alerts) == 0
    assert inc_new.is_recurring is False
    assert inc_new.status == "Reported"


def test_state_machine_illegal_transition(client, db_session):
    # Create incident
    payload = {
        "title": "Illegal transition test",
        "category": "Overflowing garbage bin",
        "description": "Test ticket",
        "severity": "Low",
        "latitude": 40.7140,
        "longitude": -74.0050,
        "address_text": "55 Broadway",
        "is_anonymous": False
    }
    create_res = client.post("/api/v1/incidents", json=payload)
    inc_id = create_res.json()["id"]

    # Citizen trying to mark directly as Resolved — Verified (should be blocked)
    bad_res = client.post(f"/api/v1/incidents/{inc_id}/status", json={
        "to_status": "Resolved — Verified",
        "role": "Citizen"
    })
    assert bad_res.status_code == 400
    assert "Illegal state transition" in bad_res.json()["detail"]

    # Field Worker trying to bypass verification directly to Resolved — Verified (should be blocked)
    worker_bad = client.post(f"/api/v1/incidents/{inc_id}/status", json={
        "to_status": "Resolved — Verified",
        "role": "Field Worker"
    })
    assert worker_bad.status_code == 400


def test_agent_tools_and_operational_audit(client, db_session):
    now = datetime.now(timezone.utc)
    # Populate test data
    loc = Location(id=50, name="Agent Test Depot", address="50 Depot Rd", latitude=40.7200, longitude=-74.0000, zone="East")
    db_session.add(loc)
    db_session.commit()

    inc = Incident(
        id="INC-AGENT-01",
        location_id=50,
        title="Agent target incident",
        category="Illegal dumping",
        description="Hazardous chemical dumping",
        severity="Critical",
        latitude=40.7200,
        longitude=-74.0000,
        address_text="50 Depot Rd",
        status="Verification Pending",
        created_at=now,
        priority_score=92.5
    )
    db_session.add(inc)
    db_session.commit()

    # 1. Test individual deterministic tools
    hotspots = tool_get_recurring_hotspots(db_session, min_recurrence=0)
    assert hotspots["tool_name"] == "get_recurring_hotspots"
    assert isinstance(hotspots["hotspots"], list)

    history = tool_get_location_history(db_session, location_id=50)
    assert history["tool_name"] == "get_location_history"
    assert history["location"]["name"] == "Agent Test Depot"
    assert len(history["incidents"]) == 1

    breakdown = tool_get_priority_breakdown(db_session, incident_id="INC-AGENT-01")
    assert breakdown["tool_name"] == "get_priority_breakdown"
    assert breakdown["priority_score"] == 92.5

    pending = tool_get_pending_resolution_reviews(db_session)
    assert pending["tool_name"] == "get_pending_resolution_reviews"
    assert pending["total_pending_count"] >= 1

    # 2. Test Agent operational audit endpoint
    audit_res = client.post("/api/v1/agent/run-audit", json={
        "audit_type": "recurrence_audit"
    })
    assert audit_res.status_code == 200
    data = audit_res.json()
    assert data["status"] == "success"
    assert len(data["tools_executed"]) >= 1
    assert "verified_facts" in data["findings"]
    assert "operational_hypotheses" in data["findings"]
    assert "recommended_municipal_actions" in data["findings"]


def test_spatial_recurrence_intelligence_exhaustive(db_session):
    now = datetime.now(timezone.utc)
    # Reference coordinates: Laxmi Nagar Metro Station (28.6304, 77.2777)
    base_lat = 28.6304
    base_lon = 77.2777

    loc = Location(id=77, name="Delhi Recurrence Lab", address="Vikas Marg, Laxmi Nagar", latitude=base_lat, longitude=base_lon, zone="East")
    db_session.add(loc)
    db_session.commit()

    # 1. Base incident: Open complaint
    inc_base = Incident(
        id="INC-REC-BASE",
        location_id=77,
        title="Base overflow complaint",
        category="Overflowing garbage bin",
        description="First base report",
        severity="Medium",
        latitude=base_lat,
        longitude=base_lon,
        address_text="Vikas Marg Pillar 40",
        status="Reported",
        created_at=now - timedelta(days=2)
    )
    db_session.add(inc_base)
    db_session.commit()

    # A. Same location, compatible category -> Must trigger recurrence
    inc_same = Incident(
        id="INC-REC-SAME",
        location_id=77,
        title="Exact same location complaint",
        category="Roadside garbage accumulation",
        description="Piles overflowing at same spot",
        severity="Medium",
        latitude=base_lat,
        longitude=base_lon,
        address_text="Vikas Marg Pillar 40",
        status="Reported",
        created_at=now
    )
    db_session.add(inc_same)
    db_session.commit()
    alerts_same = evaluate_recurrence_for_incident(db_session, inc_same, radius_meters=50.0)
    assert len(alerts_same) == 1
    assert alerts_same[0].distance_meters == 0.0

    # B. Nearby compatible (approx 22 meters north: lat + 0.0002) -> Must trigger recurrence within 50m
    inc_nearby_comp = Incident(
        id="INC-REC-NEAR-COMP",
        location_id=77,
        title="Nearby compatible complaint",
        category="Missed garbage collection",
        description="Collection missed 22m away",
        severity="Medium",
        latitude=base_lat + 0.0002,
        longitude=base_lon,
        address_text="Vikas Marg Pillar 41",
        status="Reported",
        created_at=now
    )
    db_session.add(inc_nearby_comp)
    db_session.commit()
    alerts_nearby = evaluate_recurrence_for_incident(db_session, inc_nearby_comp, radius_meters=50.0)
    assert len(alerts_nearby) >= 1
    assert alerts_nearby[0].distance_meters < 30.0

    # C. Nearby incompatible (approx 22m north, but DRAINAGE vs ACCUMULATION) -> Must NOT trigger
    inc_nearby_incomp = Incident(
        id="INC-REC-NEAR-INCOMP",
        location_id=77,
        title="Drain blockage complaint",
        category="Drain blockage caused by waste",
        description="Drain blocked",
        severity="Critical",
        latitude=base_lat + 0.0002,
        longitude=base_lon,
        address_text="Vikas Marg Drain",
        status="Reported",
        created_at=now
    )
    db_session.add(inc_nearby_incomp)
    db_session.commit()
    alerts_incomp = evaluate_recurrence_for_incident(db_session, inc_nearby_incomp, radius_meters=50.0)
    assert len(alerts_incomp) == 0

    # D. Outside configured radius (approx 220m away: lat + 0.0020) -> Must NOT trigger within 50m
    inc_far = Incident(
        id="INC-REC-FAR",
        location_id=77,
        title="Far away complaint",
        category="Overflowing garbage bin",
        description="220m away",
        severity="Medium",
        latitude=base_lat + 0.0020,
        longitude=base_lon,
        address_text="Vikas Marg Far",
        status="Reported",
        created_at=now
    )
    db_session.add(inc_far)
    db_session.commit()
    alerts_far = evaluate_recurrence_for_incident(db_session, inc_far, radius_meters=50.0)
    assert len(alerts_far) == 0

    # E. Invalid coordinates (lat=120, nan, 0,0) -> Handled safely, 0 alerts
    inc_invalid = Incident(
        id="INC-REC-INVALID",
        location_id=77,
        title="Invalid coords complaint",
        category="Overflowing garbage bin",
        description="Corrupted coords",
        severity="Medium",
        latitude=120.0,
        longitude=-250.0,
        address_text="Invalid",
        status="Reported",
        created_at=now
    )
    db_session.add(inc_invalid)
    db_session.commit()
    alerts_invalid = evaluate_recurrence_for_incident(db_session, inc_invalid, radius_meters=50.0)
    assert len(alerts_invalid) == 0

    # F. Missing coordinates (None) -> Handled safely without exception, 0 alerts
    inc_none = Incident(
        id="INC-REC-NONE",
        location_id=77,
        title="Missing coords complaint",
        category="Overflowing garbage bin",
        description="No coords",
        severity="Medium",
        latitude=None,
        longitude=None,
        address_text="No coords",
        status="Reported",
        created_at=now
    )
    # Tested without DB commit since DB schema enforces NOT NULL
    alerts_none = evaluate_recurrence_for_incident(db_session, inc_none, radius_meters=50.0)
    assert len(alerts_none) == 0


def test_demo_reset_preserves_user_records(db_session):
    # Seed standard demo records
    demo_count = seed_database(db_session)
    assert demo_count >= 15

    # Create a real citizen report (is_demo=False)
    user_inc = Incident(
        id="INC-USER-DELHI-999",
        title="Real Resident Report on Shakarpur Road",
        category="Overflowing garbage bin",
        description="Actual resident complaint filed through portal",
        severity="High",
        latitude=28.6258,
        longitude=77.2772,
        address_text="Shakarpur School Block",
        status="Reported",
        is_demo=False
    )
    db_session.add(user_inc)
    db_session.commit()

    # Verify user record is present
    assert db_session.query(Incident).filter(Incident.id == "INC-USER-DELHI-999").first() is not None

    # Reset demo database
    reset_database(db_session)

    # User record MUST still be intact!
    user_after_reset = db_session.query(Incident).filter(Incident.id == "INC-USER-DELHI-999").first()
    assert user_after_reset is not None
    assert user_after_reset.title == "Real Resident Report on Shakarpur Road"

    # All demo records should have been deleted
    demo_remnants = db_session.query(Incident).filter(Incident.is_demo == True).count()
    assert demo_remnants == 0

    # Reseed restores demo data while keeping user incident
    new_demo_count = seed_database(db_session)
    assert new_demo_count == demo_count
    assert db_session.query(Incident).filter(Incident.id == "INC-USER-DELHI-999").first() is not None


def test_dispatch_queue_priority_sorting_and_assignment(client, db_session):
    seed_database(db_session)

    # 1. Fetch dispatch queue
    res = client.get("/api/v1/dispatch/queue")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "critical_count" in data
    assert "unassigned_count" in data
    assert "items" in data
    assert data["total"] > 0

    items = data["items"]
    # Verify sorted in descending order of priority_score
    scores = [item["priority_score"] for item in items]
    assert scores == sorted(scores, reverse=True)

    # 2. Pick first unassigned incident to assign
    unassigned_item = next((i for i in items if not i["assigned_to"]), items[0])
    inc_id = unassigned_item["id"]

    assign_payload = {
        "incident_id": inc_id,
        "assigned_to": "East Delhi Sanitation Unit 4 (Rapid Response)",
        "role": "Supervisor",
        "notes": "Assigned to East Delhi Sanitation Unit 4. Emergency dispatch for repeated overflow."
    }
    assign_res = client.post("/api/v1/dispatch/assign", json=assign_payload)
    assert assign_res.status_code == 200
    assigned_data = assign_res.json()
    assert assigned_data["assigned_to"] == "East Delhi Sanitation Unit 4 (Rapid Response)"
    assert assigned_data["status"] == "Assigned"

    # Verify database persistence
    inc_in_db = db_session.query(Incident).filter(Incident.id == inc_id).first()
    assert inc_in_db.assigned_to == "East Delhi Sanitation Unit 4 (Rapid Response)"
    assert inc_in_db.status == "Assigned"

    # Verify status history entry was created
    history = db_session.query(StatusHistory).filter(StatusHistory.incident_id == inc_id).order_by(StatusHistory.id.desc()).first()
    assert history is not None
    assert history.to_status == "Assigned"
    assert "Unit 4" in history.notes


def test_root_cause_analysis_evidence_grounding(client, db_session):
    seed_database(db_session)
    # Location 1 is Laxmi Nagar Metro Station Gate 2 (known recurring hotspot with post-resolution relapse)
    res = client.get("/api/v1/locations/1/root-cause")
    assert res.status_code == 200
    rc = res.json()

    assert rc["location_id"] == 1
    assert rc["location_name"] is not None
    assert rc["total_incidents"] > 0
    assert "verified_observations" in rc
    assert "plausible_hypotheses" in rc
    assert "missing_information" in rc
    assert "recommendations" in rc

    # Verify observations are grounded with supporting incident IDs
    obs = rc["verified_observations"]
    assert len(obs) > 0
    for o in obs:
        assert "text" in o
        assert "supporting_incidents" in o
        assert isinstance(o["supporting_incidents"], list)
        assert "metrics" in o

    # Verify missing information explicitly addresses data gaps without fabricating
    missing = rc["missing_information"]
    assert len(missing) >= 3
    assert any("IoT" in m or "telemetry" in m for m in missing)
    assert any("contractor" in m or "weighbridge" in m or "GPS" in m for m in missing)

    # Verify recommendations have measurements, confidence, and verification needed
    recs = rc["recommendations"]
    assert len(recs) > 0
    for r in recs:
        assert "action" in r
        assert "rationale" in r
        assert "confidence" in r
        assert "verification_needed" in r


def test_hotspot_investigation_endpoint(client, db_session):
    seed_database(db_session)

    res = client.get("/api/v1/locations/1/investigation")
    assert res.status_code == 200
    data = res.json()

    assert "location" in data
    assert "timeline" in data
    assert "cleanups" in data
    assert "post_resolution_relapses" in data
    assert "root_cause_analysis" in data

    # Verify timeline is chronological
    timeline = data["timeline"]
    assert len(timeline) > 0
    timestamps = [e["timestamp"] for e in timeline if e.get("timestamp")]
    assert timestamps == sorted(timestamps)


def test_new_agent_operational_tools(db_session):
    seed_database(db_session)
    from backend.services.agent_service import (
        tool_get_pending_assignments,
        tool_get_recurrence_timeline,
        tool_get_hotspot_root_cause_analysis
    )

    # Test tool_get_pending_assignments
    assign_tool_res = tool_get_pending_assignments(db_session, limit=5)
    assert assign_tool_res["tool_name"] == "get_pending_assignments"
    assert "total_unassigned_count" in assign_tool_res
    assert "unassigned_queue" in assign_tool_res

    # Test tool_get_recurrence_timeline
    timeline_tool_res = tool_get_recurrence_timeline(db_session, location_id=1)
    assert timeline_tool_res["tool_name"] == "get_recurrence_timeline"
    assert timeline_tool_res["total_events"] > 0
    assert len(timeline_tool_res["timeline_events"]) > 0

    # Test tool_get_hotspot_root_cause_analysis
    rc_tool_res = tool_get_hotspot_root_cause_analysis(db_session, location_id=1)
    assert rc_tool_res["tool_name"] == "get_hotspot_root_cause_analysis"
    assert "analysis" in rc_tool_res
    assert rc_tool_res["analysis"]["location_id"] == 1



