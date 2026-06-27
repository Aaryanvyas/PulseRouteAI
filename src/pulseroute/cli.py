from __future__ import annotations

import argparse
from pathlib import Path

from .data import load_reports, write_triage
from .explain import explain_prediction
from .geo import assign_location_clusters
from .model import build_model
from .resources import extract_resources


def triage(input_path: str | Path, output_path: str | Path) -> list[dict[str, object]]:
    reports = load_reports(input_path)
    model = build_model().fit(reports)
    predictions = model.predict([report.text for report in reports])
    clusters = assign_location_clusters(reports)

    rows: list[dict[str, object]] = []
    for report, prediction in zip(reports, predictions):
        rows.append(
            {
                "report_id": report.report_id,
                "text": report.text,
                "latitude": report.latitude,
                "longitude": report.longitude,
                "predicted_urgency": prediction,
                "resources": ",".join(extract_resources(report.text)) or "none",
                "cluster_id": clusters[report.report_id],
                "explanation": ",".join(explain_prediction(report.text)) or "no strong keyword",
            }
        )

    write_triage(output_path, rows)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Run PulseRoute AI emergency report triage.")
    parser.add_argument("--input", required=True, help="CSV file containing reports")
    parser.add_argument("--output", required=True, help="Path to write triage CSV")
    args = parser.parse_args()

    rows = triage(args.input, args.output)
    print(f"Triaged {len(rows)} reports -> {args.output}")


if __name__ == "__main__":
    main()

