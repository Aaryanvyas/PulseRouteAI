# PulseRoute AI 🚨🛰️

**Real-time NLP Emergency Triage, Entity Extraction & Geospatial Disaster Command Center**

PulseRoute AI is an end-to-end Machine Learning and Geospatial Intelligence platform designed to convert noisy, unstructured emergency distress calls, tweets, and field reports into prioritized, actionable triage intelligence. 

I built this system to address a vital challenge in disaster response management: when crisis strikes, rescue teams are overwhelmed by thousands of incoming messages. PulseRoute AI instantly classifies urgency levels, extracts required emergency resources, groups geographically clustered incidents, provides transparent NLP explanations, and presents everything in an interactive GIS Command Center.

---

## 🌟 Key Architectural Highlights

### 1. 🤖 Dual-Engine NLP Urgency Classifier (`src/pulseroute/model.py`)
- **Primary Model**: Uses a `scikit-learn` Pipeline combining `TfidfVectorizer` (unigrams and bigrams, `ngram_range=(1,2)`) with a balanced `LogisticRegression` classifier (`max_iter=1000`, `class_weight='balanced'`). It predicts 4 urgency tiers: `critical`, `high`, `medium`, and `low`.
- **Zero-Dependency Fallback Engine**: If `scikit-learn` is unavailable in the environment, the system automatically falls back to a deterministic, keyword-weighted scoring model (`RulesUrgencyModel`). This ensures 100% operational reliability out-of-the-box without strict dependency requirements.

### 2. 🚑 Rule-Assisted Resource Entity Extraction (`src/pulseroute/resources.py`)
- Performs regex text normalization and scans raw reports against an emergency taxonomy matrix.
- Automatically detects and tags 8 distinct resource needs: `ambulance`, `rescue`, `food`, `water`, `shelter`, `electricity`, `fire`, and `road_clearance`.

### 3. 📍 Geospatial Incident Clustering (`src/pulseroute/geo.py`)
- Implements the mathematical **Haversine formula** (`haversine_km`) to calculate exact great-circle spherical distances between latitude and longitude coordinates.
- Dynamically groups incoming reports within a radial threshold (default `4.0 km`) into spatial cluster IDs, enabling disaster dispatchers to deploy concentrated relief teams to high-density incident zones.

### 4. 🔍 Explainable AI & Keyword Attribution (`src/pulseroute/explain.py`)
- Generates transparent, human-readable explanations for every triage decision by isolating high-impact keywords (`trapped`, `bleeding`, `collapsed`, `oxygen`, etc.) that influenced the classification score.

### 5. ⚡ Zero-Dependency REST API Server (`server.py`)
- Built entirely using Python's native standard library modules (`http.server`, `json`, `pathlib`, `mimetypes`).
- Connects directly to core `pulseroute` package logic, maintains live in-memory state, and exposes lightweight REST endpoints while serving static web assets.

### 6. 🌐 Interactive Emergency Command Center (`web/`)
- A modern single-page application built with **HTML5, Vanilla CSS3 (Custom Dark Glassmorphism theme), Vanilla JS, and Leaflet.js GIS mapping**.
- Features real-time stat counters, color-coded urgency map markers with custom popups, an interactive map coordinate picker, a live report dispatch console, and filterable/searchable incident tables.

---

## 📁 Project Structure

```text
PulseRouteAI/
├── data/
│   └── sample_reports.csv         # Initial dataset of emergency field reports
├── src/
│   └── pulseroute/                # Core Python AIML & GIS Package
│       ├── __init__.py            # Clean API package exports
│       ├── cli.py                 # Batch processing CLI pipeline
│       ├── data.py                # Report data models & CSV I/O
│       ├── explain.py             # Keyword attribution & model explainability
│       ├── geo.py                 # Haversine spatial clustering algorithms
│       ├── model.py               # TF-IDF + Logistic Regression & Rules fallback
│       └── resources.py           # NLP entity extraction for emergency supplies
├── web/                           # Emergency Command Center Web Application
│   ├── index.html                 # Semantic dashboard layout & Leaflet integration
│   ├── styles.css                 # Glassmorphism design system & neon color tokens
│   └── app.js                     # Async state management, map rendering & filters
├── tests/                         # Automated Test Suite
│   ├── test_core.py               # Core ML, spatial & extraction unit tests
│   └── test_server.py             # Integration tests for REST API endpoints
├── server.py                      # Standalone REST API & Web Host Server
├── pyproject.toml                 # Package configuration metadata
└── README.md                      # Project documentation
```

---

## 📡 REST API Reference

The backend runs on `http://localhost:8000` by default.

### 1. `GET /api/reports`
Returns all active triaged emergency reports.

**Response `200 OK`**:
```json
{
  "reports": [
    {
      "report_id": "R004",
      "text": "Building wall collapsed, two people injured and trapped under debris",
      "latitude": 19.1136,
      "longitude": 72.8697,
      "predicted_urgency": "critical",
      "resources": "ambulance,rescue",
      "cluster_id": 2,
      "explanation": "trapped,injured,collapsed"
    }
  ]
}
```

### 2. `GET /api/stats`
Returns live metric summaries.

**Response `200 OK`**:
```json
{
  "total_reports": 20,
  "critical_reports": 6,
  "high_reports": 7,
  "active_clusters": 5
}
```

### 3. `POST /api/triage`
Submits a new raw emergency report for instant ML classification and spatial clustering.

**Request Payload**:
```json
{
  "text": "Flash flood warning, family stranded on rooftop needing immediate food and drinking water",
  "latitude": 19.0750,
  "longitude": 72.8800
}
```

**Response `201 Created`**:
```json
{
  "success": true,
  "report": {
    "report_id": "R021",
    "text": "Flash flood warning, family stranded on rooftop needing immediate food and drinking water",
    "latitude": 19.075,
    "longitude": 72.88,
    "predicted_urgency": "critical",
    "resources": "food,water",
    "cluster_id": 1,
    "explanation": "food,water"
  }
}
```

---

## 🚀 Quick Start Guide

### Environment Setup

1. **Clone the repository and enter directory**:
   ```bash
   git clone https://github.com/Aaryanvyas/PulseRouteAI.git
   cd PulseRouteAI
   ```

2. **Create and activate a virtual environment**:
   - On Windows (PowerShell / CMD):
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - On Linux / macOS:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install the package in editable mode**:
   ```bash
   pip install -e .
   ```

---

### Running the Project

#### Option A: Launch the Interactive Web Dashboard & REST Server
Run the standalone server:
```bash
python server.py
```
Open your browser and go to **`http://localhost:8000`**. You will see the live GIS map, real-time stat cards, incident table, and dispatch form.

#### Option B: Execute Batch Triage CLI
Process batch CSV files from the terminal:
```bash
python -m pulseroute.cli --input data/sample_reports.csv --output triage_output.csv
```

---

## 🧪 Automated Testing Suite

I wrote comprehensive unit and integration tests covering core NLP functions, spatial math, and web API endpoints.

To run the full test suite:

- On Windows (PowerShell):
  ```powershell
  $env:PYTHONPATH="src"; python -m unittest discover -s tests -v
  ```
- On Linux / macOS:
  ```bash
  PYTHONPATH=src python3 -m unittest discover -s tests -v
  ```

**Test Output Verification**:
```text
test_cluster_assignment_groups_nearby_reports ... ok
test_explanation_returns_relevant_keywords ... ok
test_haversine_distance_is_reasonable ... ok
test_resource_extraction_detects_multiple_needs ... ok
test_rules_model_marks_life_threatening_report_critical ... ok
test_get_reports ... ok
test_post_triage ... ok

----------------------------------------------------------------------
Ran 7 tests in 2.377s - OK
```

---

## 💼 Resume Bullets & Achievements

- **Built PulseRoute AI**, an NLP-powered disaster triage platform that processes unstructured emergency reports to predict urgency and extract resource requirements in real time.
- **Engineered a dual ML engine** utilizing TF-IDF Vectorization and Logistic Regression with balanced class weighting, alongside a zero-dependency rule-based fallback model for guaranteed uptime.
- **Implemented Geospatial Incident Clustering** using the Haversine formula to group nearby emergency calls into spatial response zones.
- **Designed & Developed an Emergency Command Center** web application with Leaflet GIS mapping, custom glassmorphic UI, and a zero-dependency Python REST backend (`http.server`).
- **Achieved 100% test pass rate** across unit and HTTP integration tests using Python's `unittest` framework.

---

## 🛣️ Future Enhancements & Roadmap

1. **Transformer Upgrade**: Fine-tune a lightweight DistilBERT model for multilingual incident classification (supporting Hindi, Hinglish, and Marathi distress messages).
2. **Automated Routing**: Integrate OpenStreetMap (OSRM) API to dynamically compute shortest routes for emergency vehicles to nearest hospital or relief shelter.
3. **Omnichannel Messaging Bot**: Connect Twilio / WhatsApp APIwebhooks to ingest emergency SMS messages directly into the triage queue.

---

*Authored with ❤️ by Aaryan Vyas*
