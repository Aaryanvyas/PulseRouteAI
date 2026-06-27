# PulseRoute AI

PulseRoute AI is a resume-ready AIML project that converts noisy emergency reports into actionable triage output. It predicts urgency, extracts required resources, groups nearby incidents, and explains why each report was prioritized.

## Why this project is strong

- Real-world problem: disaster response teams must process unstructured calls, tweets, and field reports quickly.
- ML plus systems: combines NLP classification, rule-assisted entity extraction, geospatial clustering, explainability, and a CLI pipeline.
- Resume-friendly scope: can be extended into a FastAPI backend, Streamlit dashboard, or mobile reporting app.
- No GPU required: starts with TF-IDF plus logistic regression, which is practical and explainable for a second-year BTech AIML portfolio.

## Features

- Urgency classifier: predicts `critical`, `high`, `medium`, or `low`.
- Resource extraction: detects needs such as ambulance, food, water, rescue, shelter, and electricity.
- Location intelligence: clusters reports using latitude and longitude.
- Explainability: returns keywords that influenced the urgency decision.
- Batch triage: scores every report and writes a clean CSV output.
- Tests: includes lightweight unit tests for core behavior.

## Project Structure

```text
PulseRouteAI/
  data/
    sample_reports.csv
  src/
    pulseroute/
      __init__.py
      cli.py
      data.py
      explain.py
      geo.py
      model.py
      resources.py
  tests/
    test_core.py
  pyproject.toml
  README.md
```

## Quick Start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e .
python -m pulseroute.cli --input data/sample_reports.csv --output triage_output.csv
```

If `scikit-learn` is installed, PulseRoute trains a TF-IDF logistic regression model. If it is not installed, the project falls back to a deterministic keyword model so the demo still runs.

Run tests:

```bash
set PYTHONPATH=src
python -m unittest discover -s tests -v
```

## Example Output

```text
report_id: R004
predicted_urgency: critical
resources: ambulance,rescue
cluster_id: 2
explanation: trapped,injured,collapsed
```

## Resume Bullets

- Built PulseRoute AI, an NLP-based disaster triage system that classifies emergency reports by urgency and extracts resource needs from noisy text.
- Implemented an explainable TF-IDF logistic regression pipeline with a fallback rules model, enabling reproducible inference without GPU dependency.
- Added geospatial incident clustering using haversine distance to group nearby emergencies for response prioritization.
- Designed a modular Python package with CLI batch processing, test coverage, and clean CSV input/output for dashboard or API integration.

## Extension Ideas

1. Add a Streamlit dashboard with live map visualization.
2. Replace the classifier with a transformer model such as DistilBERT.
3. Add multilingual support for Hindi, Hinglish, or regional language reports.
4. Connect to Twilio, Telegram, or WhatsApp for live incident intake.
5. Use OpenStreetMap routing to recommend nearest hospital, shelter, or rescue station.
