from datetime import datetime, timezone
import json
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from backend.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    zone = Column(String(100), nullable=False, default="Central")
    is_demo = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    incidents = relationship("Incident", back_populates="location")
    recurrence_alerts = relationship("RecurrenceAlert", back_populates="location")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True, index=True)  # e.g. INC-2026-0001
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False, index=True) # Low, Medium, High, Critical
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    address_text = Column(String(500), nullable=False)
    
    # Status lifecycle
    # Reported, Assigned, Cleanup Submitted, Verification Pending, Resolved — Verified, Recurrence Detected, Reopened
    status = Column(String(50), nullable=False, default="Reported", index=True)
    is_anonymous = Column(Boolean, default=False)
    image_url = Column(String(500), nullable=True)
    image_analysis = Column(Text, nullable=True) # JSON representation of classification/confidence
    assigned_to = Column(String(100), nullable=True)
    
    # Priority & Recurrence metrics
    priority_score = Column(Float, default=0.0, index=True)
    priority_level = Column(String(20), default="Low") # Low, Medium, High, Critical
    priority_breakdown_raw = Column("priority_breakdown", Text, nullable=True) # JSON breakdown
    recurrence_count = Column(Integer, default=0)
    is_recurring = Column(Boolean, default=False, index=True)
    is_demo = Column(Boolean, default=False, index=True)
    
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    location = relationship("Location", back_populates="incidents")
    history = relationship("StatusHistory", back_populates="incident", order_by="StatusHistory.created_at.desc()")
    evidence = relationship("ResolutionEvidence", back_populates="incident", order_by="ResolutionEvidence.created_at.desc()")
    
    @property
    def priority_breakdown(self):
        if self.priority_breakdown_raw:
            try:
                return json.loads(self.priority_breakdown_raw)
            except Exception:
                return None
        return None

    @priority_breakdown.setter
    def priority_breakdown(self, value):
        if isinstance(value, str):
            self.priority_breakdown_raw = value
        elif value is not None:
            self.priority_breakdown_raw = json.dumps(value)
        else:
            self.priority_breakdown_raw = None

    @property
    def breakdown_dict(self):
        return self.priority_breakdown or {}


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    from_status = Column(String(50), nullable=False)
    to_status = Column(String(50), nullable=False)
    changed_by_role = Column(String(50), nullable=False) # Citizen, Field Worker, Supervisor, System
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    incident = relationship("Incident", back_populates="history")


class ResolutionEvidence(Base):
    __tablename__ = "resolution_evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    submitted_by_role = Column(String(50), nullable=False) # Field Worker, Supervisor
    image_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    cleanup_timestamp = Column(DateTime(timezone=True), default=utc_now)
    is_verified = Column(Boolean, default=False)
    verified_by_role = Column(String(50), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    incident = relationship("Incident", back_populates="evidence")


class RecurrenceAlert(Base):
    __tablename__ = "recurrence_alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)
    primary_incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    trigger_incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    category = Column(String(100), nullable=False)
    distance_meters = Column(Float, default=0.0)
    incident_count = Column(Integer, default=2)
    rule_triggered = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    is_post_resolution = Column(Boolean, default=False) # Recurrence after closure/cleanup!
    created_at = Column(DateTime(timezone=True), default=utc_now)

    location = relationship("Location", back_populates="recurrence_alerts")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
