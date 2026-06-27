from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

from .data import Report


def haversine_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    radius_km = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [a_lat, a_lon, b_lat, b_lon])
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
    return 2 * radius_km * asin(sqrt(h))


def assign_location_clusters(reports: list[Report], radius_km: float = 4.0) -> dict[str, int]:
    clusters: list[Report] = []
    assignments: dict[str, int] = {}

    for report in reports:
        assigned = False
        for cluster_id, center in enumerate(clusters, start=1):
            distance = haversine_km(report.latitude, report.longitude, center.latitude, center.longitude)
            if distance <= radius_km:
                assignments[report.report_id] = cluster_id
                assigned = True
                break
        if not assigned:
            clusters.append(report)
            assignments[report.report_id] = len(clusters)

    return assignments

