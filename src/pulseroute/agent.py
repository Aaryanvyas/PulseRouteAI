from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .data import Report
from .geo import haversine_km


@dataclass(frozen=True)
class EmergencyFacility:
    facility_id: str
    name: str
    facility_type: str  # hospital, fire_station, relief_shelter, police_station
    latitude: float
    longitude: float
    available_units: list[str]


# Pre-configured emergency hubs in target operations region (Mumbai Metropolitan)
EMERGENCY_FACILITIES: list[EmergencyFacility] = [
    EmergencyFacility("FAC-01", "KEM Trauma Center & Hospital", "hospital", 19.0024, 72.8423, ["ICU Ambulance", "Trauma Surgeons", "Blood Bank"]),
    EmergencyFacility("FAC-02", "Lilavati Emergency Care", "hospital", 19.0512, 72.8285, ["Advanced Life Support Ambulance", "Burn Unit"]),
    EmergencyFacility("FAC-03", "Bandra Fire Brigade Station", "fire_station", 19.0601, 72.8362, ["Heavy Water Tender", "Rescue Ladder Snorkel", "Hazmat Squad"]),
    EmergencyFacility("FAC-04", "Andheri Central Disaster Relief Hub", "relief_shelter", 19.1197, 72.8464, ["Food Distribution Squad", "Clean Water Tankers", "Temporary Tents"]),
    EmergencyFacility("FAC-05", "Kurla West Rapid Response Unit", "police_station", 19.0680, 72.8790, ["Road Clearance Crane", "Evacuation Boats", "Crowd Control"]),
    EmergencyFacility("FAC-06", "Powai General & Trauma Hospital", "hospital", 19.1230, 72.9080, ["Ambulance", "Emergency Resuscitation Unit"]),
]


@dataclass
class DispatchPlan:
    report_id: str
    urgency: str
    primary_facility: dict[str, Any]
    distance_km: float
    recommended_units: list[str]
    tactical_instructions: list[str]
    estimated_arrival_mins: int


class DispatchAgent:
    """Autonomous AI Agent that formulates tactical emergency dispatch plans."""

    def __init__(self, facilities: list[EmergencyFacility] | None = None) -> None:
        self.facilities = facilities or EMERGENCY_FACILITIES

    def find_nearest_facility(self, lat: float, lon: float, preferred_type: str | None = None) -> tuple[EmergencyFacility, float]:
        candidates = self.facilities
        if preferred_type:
            filtered = [f for f in self.facilities if f.facility_type == preferred_type]
            if filtered:
                candidates = filtered

        best_facility = candidates[0]
        min_dist = haversine_km(lat, lon, best_facility.latitude, best_facility.longitude)

        for facility in candidates[1:]:
            dist = haversine_km(lat, lon, facility.latitude, facility.longitude)
            if dist < min_dist:
                min_dist = dist
                best_facility = facility

        # If location is globally far (> 25km), synthesize a dynamic regional facility for that area
        if min_dist > 25.0:
            type_title = (preferred_type or "trauma_hospital").replace("_", " ").title()
            synth_name = f"Regional {type_title} Division (Zone {int(lat)}N-{int(lon)}E)"
            synth_facility = EmergencyFacility(
                facility_id="FAC-GLOBAL",
                name=synth_name,
                facility_type=preferred_type or "hospital",
                latitude=round(lat + 0.015, 4),
                longitude=round(lon + 0.015, 4),
                available_units=["Rapid Response Emergency Squad", "Mobile Field Hospital Unit", "Logistics Truck"]
            )
            return synth_facility, round(haversine_km(lat, lon, synth_facility.latitude, synth_facility.longitude), 2)

        return best_facility, round(min_dist, 2)

    def generate_plan(self, report_id: str, text: str, lat: float, lon: float, urgency: str, resources: list[str]) -> DispatchPlan:
        # Determine facility preference based on extracted resources
        preferred_type = "hospital"
        if "fire" in resources or "electricity" in resources:
            preferred_type = "fire_station"
        elif "shelter" in resources or "food" in resources or "water" in resources:
            preferred_type = "relief_shelter"
        elif "road_clearance" in resources or "rescue" in resources:
            preferred_type = "police_station"

        facility, dist_km = self.find_nearest_facility(lat, lon, preferred_type)

        # Build recommended response units
        units: list[str] = []
        if "ambulance" in resources or urgency in ("critical", "high"):
            units.append("1x Advanced Life Support Ambulance")
        if "rescue" in resources or "fire" in resources:
            units.append("1x Heavy Rescue & Extraction Vehicle")
        if "food" in resources or "water" in resources or "shelter" in resources:
            units.append("1x Rapid Logistics Mobile Supply Truck")
        if "road_clearance" in resources:
            units.append("1x Hydraulic Crane & Road Clearance Crew")

        if not units:
            units.append("1x Mobile Field Patrol Inspection Unit")

        # Tactical Instructions based on Urgency & Context
        instructions: list[str] = [
            f"Establish immediate comms link with {facility.name} ({dist_km} km away).",
        ]

        if urgency == "critical":
            instructions.append("PRIORITY CODE RED: Dispatch units with sirens active. Request traffic signals override.")
            instructions.append("Prepare trauma receiving bay and alert attending emergency surgeons.")
        elif urgency == "high":
            instructions.append("PRIORITY CODE YELLOW: Dispatch units under express response protocol.")
            instructions.append("Establish perimeter staging area near report coordinates.")
        else:
            instructions.append("STANDARD DISPATCH: Route nearest patrol unit to verify field situation.")

        if "trapped" in text.lower() or "collapsed" in text.lower():
            instructions.append("Deploy acoustic search sensors and hydraulic cutting equipment.")
        if "flooded" in text.lower() or "water" in text.lower():
            instructions.append("Verify road impassable zones before dispatching heavy vehicles.")

        # Estimate arrival time (assuming average emergency speed of 40 km/h)
        eta_mins = max(3, int((dist_km / 40.0) * 60) + (2 if urgency == "critical" else 5))

        return DispatchPlan(
            report_id=report_id,
            urgency=urgency,
            primary_facility={
                "id": facility.facility_id,
                "name": facility.name,
                "type": facility.facility_type,
                "latitude": facility.latitude,
                "longitude": facility.longitude,
            },
            distance_km=dist_km,
            recommended_units=units,
            tactical_instructions=instructions,
            estimated_arrival_mins=eta_mins,
        )
