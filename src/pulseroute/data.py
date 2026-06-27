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
    address: str = "Unspecified Location"
    urgency: str | None = None


def resolve_neighborhood(lat: float, lon: float) -> str:
    """Helper to resolve approximate Mumbai neighborhood based on coordinates."""
    if lat < 19.040:
        return "Colaba / Fort, South Mumbai"
    elif lat < 19.070:
        return "Dadar / Worli, Central Mumbai"
    elif lat < 19.090 and lon < 72.850:
        return "Bandra West, Mumbai"
    elif lat < 19.090 and lon >= 72.850:
        return "Kurla / Ghatkopar, East Mumbai"
    elif lat < 19.120 and lon < 72.860:
        return "Juhu / Vile Parle, Mumbai"
    elif lat < 19.120 and lon >= 72.860:
        return "Andheri East / MIDC, Mumbai"
    elif lat < 19.150 and lon < 72.860:
        return "Goregaon / Malad, North West Mumbai"
    elif lat < 19.150 and lon >= 72.860:
        return "Powai / Kanjurmarg, Central Suburbs"
    else:
        return "Borivali / Thane Region, Mumbai Metropolitan"


def load_reports(path: str | Path) -> list[Report]:
    reports: list[Report] = []
    with Path(path).open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            addr = row.get("address") or resolve_neighborhood(lat, lon)
            reports.append(
                Report(
                    report_id=row["report_id"],
                    text=row["text"],
                    latitude=lat,
                    longitude=lon,
                    address=addr,
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

