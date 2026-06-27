# PulseRoute AI

PulseRoute AI is an emergency report triage system that converts unstructured distress messages (field reports, calls, tweets) into prioritized, actionable intelligence. It automatically classifies urgency levels, extracts required emergency resources, groups geographically clustered incidents, provides keyword-based explanations, and displays everything on a real-time 3D GIS Command Center dashboard.

I built this project to tackle a core challenge in disaster management: during natural disasters or major emergencies, first responders receive thousands of incoming messages and need an automated way to instantly prioritize life-threatening situations and allocate resources effectively.

---

## Technical Architecture

The core of PulseRoute AI is modularly designed around Python systems, Machine Learning, and 3D GIS WebGL mapping.

### 1. Natural Language Urgency Classification (`src/pulseroute/model.py`)
- **Primary Pipeline**: Implements a `scikit-learn` pipeline using `TfidfVectorizer` (extracting unigrams and bigrams) and a balanced `LogisticRegression` classifier to predict urgency across four levels: `critical`, `high`, `medium`, and `low`.
- **Deterministic Fallback Engine**: If `scikit-learn` is not installed in the target execution environment, the system gracefully falls back to a custom keyword-scoring model (`RulesUrgencyModel`). This guarantees zero downtime and instant out-of-the-box execution.

### 2. Emergency Resource Entity Extraction (`src/pulseroute/resources.py`)
- Uses regex normalization and keyword taxonomy mapping to automatically identify emergency resource requirements: `ambulance`, `rescue`, `food`, `water`, `shelter`, `electricity`, `fire`, and `road_clearance`.

### 3. Geospatial Incident Clustering & Address Resolution (`src/pulseroute/geo.py` & `data.py`)
- Applies the **Haversine formula** to calculate exact spherical distances across latitude and longitude coordinates.
- Dynamically groups reports within a radial threshold (default `4.0 km`) into spatial cluster IDs, helping dispatch teams identify high-density disaster zones.
- Includes automated neighborhood resolution and exact street address resolution for every incident pin.

### 4. Keyword Attribution & Explainability (`src/pulseroute/explain.py`)
- Generates transparent, human-readable explanations for every model decision by isolating top contributing keywords (`trapped`, `bleeding`, `collapsed`, `oxygen`, etc.).

### 5. Autonomous AI Dispatch Agent (`src/pulseroute/agent.py`)
- Serves as an automated dispatch coordinator. When a critical report is processed, the agent queries regional emergency facilities (hospitals, fire stations, relief shelters), calculates exact proximity (km) and arrival ETAs, recommends specific response units, and generates step-by-step tactical directives.
- Features global dynamic hub synthesis to formulate tactical dispatch plans for any location worldwide.

### 6. Zero-Dependency REST API & Web Server (`server.py`)
- Built using Python's native `http.server` standard library modules to keep the backend lightweight without requiring external web frameworks.
- Maintains in-memory report state, exposes REST endpoints (`/api/reports`, `/api/triage`, `/api/stats`, `/api/agent/dispatch`), and hosts static web assets.

### 7. Interactive 3D WebGL Command Center (`web/`)
- A modern single-page application built with HTML5, Vanilla CSS3 (glassmorphic dark theme), Vanilla JavaScript, and **MapLibre GL JS 3D Vector Maps**.
- Features 3D camera pitch and bearing controls, live metric cards, interactive map pin popups with real-time OpenStreetMap reverse geocoding, one-click auto-triage report generation, and an interactive modal for the AI Dispatch Agent's tactical plans.

---

## Repository Structure

```text
PulseRouteAI/
├── data/
│   └── sample_reports.csv         # Sample dataset of emergency field reports
├── src/
│   └── pulseroute/                # Core Python package
│       ├── __init__.py            # Package exports
│       ├── agent.py               # Autonomous AI Dispatch Agent & Hub Locator
│       ├── cli.py                 # Batch processing CLI script
│       ├── data.py                # Data structures, address & neighborhood handling
│       ├── explain.py             # Keyword attribution logic
│       ├── geo.py                 # Haversine spatial clustering
│       ├── model.py               # TF-IDF + Logistic Regression & Rules fallback
│       └── resources.py           # Resource entity extraction
├── web/                           # Command Center 3D Web Dashboard
│   ├── index.html                 # Dashboard HTML layout & MapLibre 3D container
│   ├── styles.css                 # Custom CSS design system & 3D popup styles
│   └── app.js                     # 3D map engine, reverse geocoding & API integration
├── tests/                         # Test suite
│   ├── test_agent.py              # Dispatch agent tests
│   ├── test_core.py               # Core ML & spatial unit tests
│   └── test_server.py             # REST API integration tests
├── Dockerfile                     # Docker container configuration
├── .dockerignore                  # Docker ignore rules
├── server.py                      # REST API & static file web server
├── pyproject.toml                 # Package metadata
└── README.md                      # Documentation
```

---

## API Documentation

The REST server runs on `http://localhost:8000`.

### `GET /api/reports`
Retrieves all current triaged emergency reports.

```json
{
  "reports": [
    {
      "report_id": "R004",
      "text": "Building wall collapsed, two people injured and trapped under debris",
      "latitude": 19.1136,
      "longitude": 72.8697,
      "address": "Marol Naka Industrial Estate, Andheri East, Mumbai",
      "predicted_urgency": "critical",
      "resources": "ambulance,rescue",
      "cluster_id": 2,
      "explanation": "trapped,injured,collapsed"
    }
  ]
}
```

### `POST /api/triage`
Submits a new raw report for instant ML triage and clustering.

**Request Payload**:
```json
{
  "text": "Flash flood warning, family stranded on roof needing food and clean water",
  "address": "Plot 45, Premier Road, Kurla East, Mumbai",
  "latitude": 19.0750,
  "longitude": 72.8800
}
```

### `POST /api/agent/dispatch`
Generates a tactical response plan from the AI Dispatch Agent for a given report.

**Request Payload**:
```json
{
  "report_id": "R004"
}
```

---

## How to Run locally

### 1. Setup Environment

Clone the repository and set up a virtual environment:

```bash
git clone https://github.com/Aaryanvyas/PulseRouteAI.git
cd PulseRouteAI

# Create virtual environment
python -m venv .venv

# Activate environment (Windows PowerShell)
.venv\Scripts\activate

# Activate environment (Linux / macOS)
source .venv/bin/activate

# Install package in editable mode
pip install -e .
```

### 2. Start the 3D Web Dashboard & REST API
Run the server:
```bash
python server.py
```
Open your browser and go to `http://localhost:8000`.

### 3. Run Batch CLI Processing
To run batch triage directly on a CSV file:
```bash
python -m pulseroute.cli --input data/sample_reports.csv --output triage_output.csv
```

---

## Running Tests

To run the complete unit and integration test suite:

**Windows**:
```powershell
$env:PYTHONPATH="src"; python -m unittest discover -s tests -v
```

**Linux / macOS**:
```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

---

## Docker Deployment

To build and run the application using Docker:

```bash
docker build -t pulseroute-ai .
docker run -p 8000:8000 pulseroute-ai
```

---

Author: Aaryan Vyas
