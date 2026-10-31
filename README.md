# ♻️ WasteTrace AI
### AI-Powered Municipal Waste Intelligence & Recurrence Detection Platform

> **"Don't just close complaints. Verify that the problem stays solved."**

WasteTrace AI is an AI-powered municipal operations intelligence platform designed to identify recurring waste-management failures, prioritize sanitation incidents, track cleanup verification, and help municipal supervisors make evidence-based operational decisions.

Unlike conventional complaint-tracking systems that focus primarily on closing individual tickets, WasteTrace AI connects incident history, geospatial intelligence, post-resolution recurrence detection, and explainable operational recommendations to investigate why waste-related problems keep returning.

**Built for HackCulture 9.0 | GreenTech + Artificial Intelligence**

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg?logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Pytest](https://img.shields.io/badge/Pytest-18%20Passing-success.svg?logo=pytest&logoColor=white)](https://pytest.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌍 The Problem

Cities already have portals and helplines for reporting sanitation issues (overflowing bins, open dumps, choked drains). However, closing an individual complaint ticket does not mean the underlying municipal problem has been permanently solved.

### Common Operational Blind Spots:
1. **The Cleanup-Relapse Cycle**:
   - Day 1: Citizen reports an overflowing bin near a metro station.
   - Day 2: Sanitation crew sweeps the site and marks the ticket *"Resolved"*.
   - Day 4: The same bin overflows again because bin capacity or collection frequency was never adjusted.
   - Day 5: A new complaint is filed and treated as an isolated incident, masking the chronic failure.
2. **Disconnected Records**: Complaints are scattered across dates with no spatial correlation or historical memory.
3. **Lack of Photographic Accountability**: Tickets are closed without timestamped before/after photographic verification.
4. **Arbitrary Priority Triage**: Incidents are prioritized on first-come-first-serve rather than true recurrence risk, public health hazards, or severe drain blockages.

**The Core Challenge**: Existing platforms monitor *complaint closure*, not *sustained resolution*.

---

## 💡 Our Solution: Recurrence Intelligence

WasteTrace AI shifts municipal waste management from reactive ticket-closing to **proactive recurrence prevention**.

The platform combines geospatial incident tracking, deterministic recurrence detection, explainable priority scoring, resolution verification, and an operational AI agent to answer the **Five Critical Operational Questions**:

| # | Operational Question | How WasteTrace AI Solves It |
|---|----------------------|-----------------------------|
| 1 | **Where are waste problems happening?** | Interactive Delhi Hotspot Map powered by OpenStreetMap with real neighborhood zoom. |
| 2 | **Which locations repeatedly fail?** | Deterministic Haversine spatial radius + temporal window recurrence engine. |
| 3 | **Which incidents need attention first?** | Transparent 4-factor priority score with an Urgent Critical Safeguard. |
| 4 | **Was cleanup actually submitted & verified?** | Closed-loop before/after photographic evidence audit trail verified by supervisors. |
| 5 | **Did the problem return after resolution?** | Automated Post-Resolution Relapse monitoring over a 30-day passive watch window. |

---

## ✨ Key Platform Features

### 1. 🗺️ Interactive Delhi Hotspot Map
- **Real Geographic Coordinates**: Centered on East Delhi (Laxmi Nagar, Nirman Vihar, Preet Vihar, Shakarpur, Pandav Nagar, Patparganj, Swasthya Vihar, Anand Vihar).
- **Pulsing Relapse Rings**: Visually highlights locations that relapsed after supervisor verification with animated pulse rings.
- **Location Inspection**: Click any marker or cluster to inspect full audit history or launch deep-dive investigations.
- **Data Transparency**: Clear distinction between genuine citizen reports and demonstration scenarios (`is_demo`).

### 2. 📍 Smart Incident Reporting
- **Map Pin Selection**: Click anywhere on the Delhi map to automatically reverse-geocode and capture precise coordinates.
- **Address Search**: Search Delhi landmarks and metro stations using Nominatim OpenStreetMap integration.
- **Browser Geolocation**: One-click GPS location with permission handling and coordinate validation.
- **AI Vision Pre-Classification**: Upload an image to auto-detect waste category, severity estimate, and visible objects (Gemini API with robust offline fallback).

### 3. 🔁 Recurrence Intelligence Engine
- **Spatial Clustering**: Geodesic Haversine formula calculates exact physical distance between incidents (default: 50m threshold).
- **Category Compatibility**: Distinguishes compatible issues (e.g. *Overflowing bin* ↔ *Roadside accumulation*) from incompatible categories.
- **Temporal Windows**: Identifies active recurrence clusters within 14 days and post-resolution relapses within 30 days.
- **Relapse Metrics**: Tracks Mean Time Between Relapses (MTBR) in days for municipal capacity planning.

### 4. ⚖️ Explainable Multi-Factor Priority Scoring
- Transparent formula combining four weighted factors:
  $$\text{Priority} = (W_{\text{sev}} \times S_{\text{sev}}) + (W_{\text{rec}} \times S_{\text{rec}}) + (W_{\text{dur}} \times S_{\text{dur}}) + (W_{\text{ev}} \times S_{\text{ev}})$$
- **Urgent Critical Safeguard**: Any incident with `Critical` severity (e.g. hazardous medical waste, culvert drain blockage) automatically enforces a minimum score of $\ge 85.0$, bypassing conventional score dampening.
- **Full Factor Breakdown**: Every incident card displays an interactive mathematical breakdown of why it received its score.

### 5. 🚛 Smart Dispatch Queue (`/dispatch`)
- Priority-ranked operational work queue for East Delhi supervisors and field crews.
- Dynamic filtering by Priority Level, Status, Zone, and Unassigned state.
- One-click assignment to demo sanitation response units:
  - *East Delhi Rapid Response Unit 1 (Vikas Marg)*
  - *Sanitation Crew Alpha (Heavy Compactor)*
  - *Drainage Desilting Unit 3 (Ghazipur/Pandav Nagar)*
  - *Commercial Market Collection Unit 2 (Preet Vihar)*
  - *Emergency Flyover Clearance Squad (Anand Vihar)*
- Real-time persistent state transition (`Reported` → `Assigned`) and audit history logging.

### 6. 🔍 Evidence-Based Root Cause Intelligence
- Dedicated diagnostic engine for supervisors that strictly separates findings into:
  - **Part A: Verified Observations**: Grounded in supporting incident IDs and database metrics (category concentration, relapse frequency, MTBR).
  - **Part B: Plausible Hypotheses**: Clear operational hypotheses with caveats (e.g. container volume deficit vs commercial surge).
  - **Part C: Missing Information (Data Gaps)**: Explicitly surfaces unmeasured variables (no IoT bin sensors, missing truck weighbridge receipts) to prevent false claims.
  - **Part D: Explainable Recommendations**: Actions with confidence ratings, measurements, and required verification steps before municipal capital spend.

### 7. 🤖 Deterministic Operational AI Agent
- 7 Read-Only Database Tools registered for controlled, grounded decision support:
  1. `get_recurring_hotspots`
  2. `get_location_history`
  3. `get_priority_breakdown`
  4. `get_pending_resolution_reviews`
  5. `get_pending_assignments`
  6. `get_recurrence_timeline`
  7. `get_hotspot_root_cause_analysis`
- Run automated audit workflows: Recurrence Audit, Root Cause Audit, Dispatch Queue Audit, SLA & Evidence Audit, and Priority Safeguard Audit.

### 8. 📸 Closed-Loop Resolution Verification
- Field workers submit photographic cleanup evidence and field completion notes.
- Status advances to `Verification Pending`.
- Supervisor inspects photo evidence:
  - **Approve**: Incident marked `Resolved — Verified` with timestamp; enters 30-day passive monitoring.
  - **Reject**: Incident reopened with documented rejection reason.

---

## 🏛️ System Architecture

```
waste-trace-ai/
├── backend/
│   ├── engines/
│   │   ├── recurrence_engine.py      # Haversine distance + Category Matrix + Relapse Detection
│   │   ├── priority_engine.py        # Transparent 4-factor scoring + Urgent Safeguard
│   │   └── root_cause_engine.py      # Grounded 4-part root cause diagnostic engine
│   ├── services/
│   │   ├── ai_service.py             # Vision AI (Gemini + Local Fallback) + Pattern Insights
│   │   └── agent_service.py          # 7 Deterministic tools + Audit runner
│   ├── models.py                     # SQLAlchemy models (Incident, Location, Evidence, History, Alert)
│   ├── schemas.py                    # Strict Pydantic v2 schemas
│   ├── seed.py                       # 8 East Delhi demonstration locations & 20 incidents
│   ├── database.py                   # SQLite engine with SessionLocal
│   ├── config.py                     # App configuration & tunable weights
│   └── main.py                       # FastAPI application & REST endpoints
├── frontend/
│   ├── src/
│   │   ├── components/               # Navbar, Sidebar, Modals, Geocoding search
│   │   │   ├── HotspotInvestigationModal.tsx  # 4-part Root Cause & Timeline modal
│   │   │   ├── IncidentDetailModal.tsx        # Audit trail & Supervisor verification
│   │   │   └── LeafletMapPinSelector.tsx      # Map click coordinate selection
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx                  # Executive summary & quick stats
│   │   │   ├── HotspotMap.tsx                 # Interactive Delhi map with pulsing rings
│   │   │   ├── SmartDispatchQueue.tsx         # Priority work queue & crew dispatch
│   │   │   ├── RecurringFailures.tsx          # Relapse & cluster monitoring
│   │   │   ├── IncidentExplorer.tsx           # Multi-filter incident registry
│   │   │   ├── ResolutionTracking.tsx         # Photographic verification queue
│   │   │   ├── AIInsights.tsx                 # Grounded Insights & Operational Agent
│   │   │   ├── Analytics.tsx                  # Performance charts & category breakdowns
│   │   │   └── Settings.tsx                   # Tunable engine parameters & demo reset
│   │   ├── config/mapConfig.ts       # East Delhi center coordinates & map tiles
│   │   └── services/api.ts           # Type-safe API client
└── tests/
    └── test_backend.py               # 18 comprehensive automated backend tests
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+** (Python 3.11 - 3.13 supported)
- **Node.js 18+** & **npm**

### Quick Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/kumarakshu/hack9.0.git
cd hack9.0
```

#### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
cd ..
```

#### 4. Run the Application
You can use the provided startup scripts:

**On Windows:**
```powershell
.\start_dev.bat
# OR
.\start_dev.ps1
```

**Or run services manually in two terminals:**
```bash
# Terminal 1 - Backend (FastAPI)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 - Frontend (Vite)
cd frontend
npm run dev
```

Open your browser at **`http://localhost:5173`**.  
Interactive API docs are available at **`http://127.0.0.1:8000/docs`**.

---

## 🧪 Testing & Verification

Run the full automated test suite covering Haversine distance, boundary conditions, priority calculation, recurrence detection, dispatch queue sorting, worker assignment persistence, root cause grounding, and operational agent tools:

```bash
# Run backend pytest suite (18 tests)
pytest tests/ -v

# Run frontend production build
cd frontend
npm run build
```

**Test Suite Coverage Summary:**
- `test_haversine_distance`: Exact geodesic calculation & zero-distance matching.
- `test_category_compatibility`: Symmetric category matrix verification.
- `test_explainable_priority_scoring_and_safeguard`: Score components & $\ge 85.0$ critical override.
- `test_recurrence_detection_and_post_resolution`: 30-day post-resolution relapse detection.
- `test_dispatch_queue_priority_sorting_and_assignment`: Priority sorting and persistent crew assignment.
- `test_root_cause_analysis_evidence_grounding`: Grounded incident ID references and missing data disclosures.
- `test_hotspot_investigation_endpoint`: Chronological event streams and cleanup evidence.
- `test_new_agent_operational_tools`: Tool execution outputs.
- `test_demo_reset_preserves_user_records`: Safe idempotent reset preserving user-submitted incidents.

---

## 🎯 Demo Walkthrough for Judges

1. **Overview Dashboard** (`/`): Inspect city-wide recurrence rate, resolution metrics, and post-resolution relapses.
2. **Delhi Hotspot Map** (`/map`): Explore East Delhi locations. Spot the pulsing red marker at *Laxmi Nagar Metro Gate 2* denoting repeated post-resolution relapses.
3. **Smart Dispatch Queue** (`/dispatch`): Review the priority work queue. Critical drain blockage at *Pandav Nagar* sits at rank #1. Assign a response unit using the dropdown and observe the instant persistent transition.
4. **Hotspot Investigation**: Click **Investigate Hotspot** on any location to view the 4-part root cause diagnostic: verified observations with supporting IDs, plausible hypotheses, data gaps, and explainable recommendations.
5. **Report an Incident** (`/report`): Click on the interactive map to pin a location, enter details, and watch the system automatically evaluate recurrence against nearby historical complaints.
6. **AI Insights & Autonomous Agent** (`/insights`): Switch to the **Autonomous Agent** tab to execute a live **Root Cause Audit** or **Dispatch Queue Audit** powered by 7 deterministic database tools.

---

## 👥 Hackathon Team & Project Info

- **Project**: WasteTrace AI
- **Event**: HackCulture 9.0 (GreenTech + Artificial Intelligence)
- **Theme**: Intelligent Municipal Sanitation Operations
- **Core Mission**: *"Don't just close complaints. Verify that the problem stays solved."*

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
