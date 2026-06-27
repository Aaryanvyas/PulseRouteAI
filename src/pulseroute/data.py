from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Report:
    report_id: str
    text: str
    latitude: float
    longitude: float
    urgency: str | None = None


def load_reports(path: str | Path) -> list[Report]:
    reports: list[Report] = []
    with Path(path).open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            reports.append(
                Report(
                    report_id=row["report_id"],
                    text=row["text"],
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    urgency=row.get("urgency") or None,
                )
            )
    return reports


def write_triage(path: str | Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    with Path(path).open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

