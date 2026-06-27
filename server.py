#!/usr/bin/env python3
"""PulseRoute AI - Emergency Command Center REST API & Static Server."""

from __future__ import annotations

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import sys

# Ensure pulseroute package in src/ is importable
BASE_DIR = Path(__file__).resolve().parent
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from pulseroute import (
    DispatchAgent,
    Report,
    assign_location_clusters,
    build_model,
    explain_prediction,
    extract_resources,
    load_reports,
)

DATA_FILE = BASE_DIR / "data" / "sample_reports.csv"
TRIAGE_FILE = BASE_DIR / "triage_output.csv"
WEB_DIR = BASE_DIR / "web"

# Global in-memory report state & trained model
reports_list: list[Report] = []
triaged_rows: list[dict[str, object]] = []
model_instance = None
dispatch_agent = DispatchAgent()


def init_state() -> None:
    global reports_list, triaged_rows, model_instance
    print("[PulseRoute API] Initializing emergency report system state...")
    if DATA_FILE.exists():
        reports_list = load_reports(DATA_FILE)
    else:
        reports_list = []

    model_instance = build_model().fit(reports_list)
    recalculate_triage()
    print(f"[PulseRoute API] State initialized with {len(triaged_rows)} reports.")


def recalculate_triage() -> None:
    global reports_list, triaged_rows, model_instance
    if not reports_list:
        triaged_rows = []
        return

    predictions = model_instance.predict([r.text for r in reports_list])
    clusters = assign_location_clusters(reports_list)

    new_rows: list[dict[str, object]] = []
    for report, prediction in zip(reports_list, predictions):
        new_rows.append(
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
    triaged_rows = new_rows


class PulseRouteHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        # Standard clean logging
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def do_GET(self) -> None:
        url_path = self.path.split("?")[0]

        # API Endpoints
        if url_path == "/api/reports":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"reports": triaged_rows}).encode("utf-8"))
            return

        if url_path == "/api/stats":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            total = len(triaged_rows)
            critical = sum(1 for r in triaged_rows if r["predicted_urgency"] == "critical")
            high = sum(1 for r in triaged_rows if r["predicted_urgency"] == "high")
            clusters_count = len(set(r["cluster_id"] for r in triaged_rows)) if triaged_rows else 0
            
            stats = {
                "total_reports": total,
                "critical_reports": critical,
                "high_reports": high,
                "active_clusters": clusters_count,
            }
            self.wfile.write(json.dumps(stats).encode("utf-8"))
            return

        # Static file serving
        clean_path = url_path.lstrip("/")
        if not clean_path or clean_path == "index.html":
            target_path = WEB_DIR / "index.html"
        else:
            target_path = WEB_DIR / clean_path

        # Security check to prevent directory traversal
        try:
            target_path = target_path.resolve()
            if not str(target_path).startswith(str(WEB_DIR.resolve())):
                self.send_error(403, "Access Denied")
                return
        except Exception:
            self.send_error(404, "File Not Found")
            return

        if target_path.exists() and target_path.is_file():
            mime_type, _ = mimetypes.guess_type(str(target_path))
            if target_path.suffix == ".js":
                mime_type = "application/javascript"
            elif target_path.suffix == ".css":
                mime_type = "text/css"
            
            self.send_response(200)
            self.send_header("Content-Type", mime_type or "application/octet-stream")
            self.end_headers()
            with open(target_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, f"File Not Found: {url_path}")

    def do_POST(self) -> None:
        url_path = self.path.split("?")[0]
        if url_path == "/api/triage":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode("utf-8"))
                text = payload.get("text", "").strip()
                lat = float(payload.get("latitude", 0.0))
                lon = float(payload.get("longitude", 0.0))

                if not text:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Report text is required"}).encode("utf-8"))
                    return

                # Generate new ID
                next_id_num = len(reports_list) + 1
                new_id = f"R{next_id_num:03d}"

                new_report = Report(
                    report_id=new_id,
                    text=text,
                    latitude=lat,
                    longitude=lon,
                )

                reports_list.append(new_report)
                recalculate_triage()

                # Find the created row
                created_row = next(r for r in triaged_rows if r["report_id"] == new_id)

                self.send_response(201)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "report": created_row}).encode("utf-8"))

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if url_path == "/api/agent/dispatch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
                report_id = payload.get("report_id")

                # Find targeted report
                target_row = None
                if report_id:
                    target_row = next((r for r in triaged_rows if r["report_id"] == report_id), None)
                
                if not target_row and triaged_rows:
                    target_row = triaged_rows[0]

                if not target_row:
                    self.send_response(404)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "No report found to generate dispatch plan"}).encode("utf-8"))
                    return

                res_list = [r.strip() for r in str(target_row["resources"]).split(",") if r.strip() and r != "none"]
                
                plan = dispatch_agent.generate_plan(
                    report_id=str(target_row["report_id"]),
                    text=str(target_row["text"]),
                    lat=float(target_row["latitude"]),
                    lon=float(target_row["longitude"]),
                    urgency=str(target_row["predicted_urgency"]),
                    resources=res_list,
                )

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "dispatch_plan": {
                        "report_id": plan.report_id,
                        "urgency": plan.urgency,
                        "primary_facility": plan.primary_facility,
                        "distance_km": plan.distance_km,
                        "recommended_units": plan.recommended_units,
                        "tactical_instructions": plan.tactical_instructions,
                        "estimated_arrival_mins": plan.estimated_arrival_mins,
                    }
                }).encode("utf-8"))

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_error(404, "Endpoint Not Found")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def run_server(port: int = 8000) -> None:
    init_state()
    server_address = ("", port)
    httpd = HTTPServer(server_address, PulseRouteHandler)
    print(f"[PulseRoute AI] Server running on http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[PulseRoute AI] Shutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
