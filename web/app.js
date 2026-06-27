/* ==========================================================================
   PulseRoute AI - Emergency Command Center Client Application Logic
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let allReports = [];
  let activeFilter = "all";
  let searchQuery = "";
  let map = null;
  let mapMarkers = [];
  let tempMarker = null;

  // Urgency Colors Mapping
  const urgencyColors = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#3b82f6",
  };

  // DOM Elements
  const statTotal = document.getElementById("stat-total");
  const statCritical = document.getElementById("stat-critical");
  const statHigh = document.getElementById("stat-high");
  const statClusters = document.getElementById("stat-clusters");

  const badgeAll = document.getElementById("badge-all");
  const badgeCritical = document.getElementById("badge-critical");
  const badgeHigh = document.getElementById("badge-high");
  const badgeMedium = document.getElementById("badge-medium");
  const badgeLow = document.getElementById("badge-low");

  const tableBody = document.getElementById("table-body");
  const searchInput = document.getElementById("search-input");
  const filterTabs = document.querySelectorAll(".filter-tabs .tab");

  const triageForm = document.getElementById("triage-form");
  const reportTextInput = document.getElementById("report-text");
  const addressInput = document.getElementById("address");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const submitBtn = document.getElementById("submit-btn");
  const triageResult = document.getElementById("triage-result");
  const toggle3dBtn = document.getElementById("toggle-3d-btn");
  const mapWrapper = document.getElementById("map-wrapper");

  let is3dMode = false;
  if (toggle3dBtn && mapWrapper) {
    toggle3dBtn.addEventListener("click", () => {
      is3dMode = !is3dMode;
      if (is3dMode) {
        mapWrapper.classList.add("mode-3d");
        toggle3dBtn.classList.add("active");
        toggle3dBtn.textContent = "🛰️ 3D Perspective Active";
      } else {
        mapWrapper.classList.remove("mode-3d");
        toggle3dBtn.classList.remove("active");
        toggle3dBtn.textContent = "🛰️ Toggle 3D Perspective";
      }
      setTimeout(() => { map.invalidateSize(); }, 300);
    });
  }

  // Initialize Map
  function initMap() {
    // Default center around Mumbai reports region
    const defaultLat = 19.0800;
    const defaultLng = 72.8700;

    map = L.map("map", {
      zoomControl: true,
      attributionControl: false
    }).setView([defaultLat, defaultLng], 11);

    // Dark canvas tiles (CartoDB Dark Matter)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(map);

    // Map click to select coordinates
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      latitudeInput.value = lat.toFixed(4);
      longitudeInput.value = lng.toFixed(4);

      if (tempMarker) {
        map.removeLayer(tempMarker);
      }

      tempMarker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "#06b6d4",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map).bindPopup("<b>Target Location Selected</b><br>Coordinates captured for report dispatch.").openPopup();
    });
  }

  // Render Map Markers
  function renderMapMarkers(reports) {
    // Clear existing markers
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];

    if (!reports || reports.length === 0) return;

    const bounds = L.latLngBounds();

    reports.forEach(report => {
      const color = urgencyColors[report.predicted_urgency] || "#94a3b8";
      const isCritical = report.predicted_urgency === "critical";

      const circleMarker = L.circleMarker([report.latitude, report.longitude], {
        radius: isCritical ? 10 : 7,
        fillColor: color,
        color: "#ffffff",
        weight: isCritical ? 2 : 1,
        opacity: 0.9,
        fillOpacity: 0.85
      }).addTo(map);

      // HTML Popup details
      const popupHtml = `
        <div class="popup-content">
          <h4>
            <span>${report.report_id}</span>
            <span class="urgency-badge ${report.predicted_urgency}">${report.predicted_urgency}</span>
          </h4>
          <p style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; margin-bottom: 4px;">📍 ${escapeHtml(report.address || "Mumbai")}</p>
          <p class="popup-text">"${report.text}"</p>
          <div class="popup-meta" style="margin-bottom: 8px;">
            <strong>Resources:</strong> ${report.resources}<br>
            <strong>Cluster:</strong> Zone #${report.cluster_id}
          </div>
          <button class="btn-agent" onclick="triggerAgentDispatch('${report.report_id}')" style="width: 100%; justify-content: center;">
            🤖 Generate AI Dispatch Plan
          </button>
        </div>
      `;

      circleMarker.bindPopup(popupHtml);
      mapMarkers.push(circleMarker);
      bounds.extend([report.latitude, report.longitude]);
    });

    if (reports.length > 0 && !tempMarker) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  // Fetch Data from REST API
  async function fetchReports() {
    try {
      const response = await fetch("/api/reports");
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      allReports = data.reports || [];
      updateUI();
    } catch (err) {
      console.error("[PulseRoute UI] Error loading reports:", err);
    }
  }

  // Update UI (Metrics, Badges, Table & Map)
  function updateUI() {
    updateMetrics();
    renderTable();
    
    // Filter reports for map display based on current active tab
    const filteredForMap = filterReportsList(allReports);
    renderMapMarkers(filteredForMap);
  }

  // Update Summary Metrics
  function updateMetrics() {
    const total = allReports.length;
    const critical = allReports.filter(r => r.predicted_urgency === "critical").length;
    const high = allReports.filter(r => r.predicted_urgency === "high").length;
    const medium = allReports.filter(r => r.predicted_urgency === "medium").length;
    const low = allReports.filter(r => r.predicted_urgency === "low").length;

    const clustersSet = new Set(allReports.map(r => r.cluster_id));

    statTotal.textContent = total;
    statCritical.textContent = critical;
    statHigh.textContent = high;
    statClusters.textContent = clustersSet.size;

    badgeAll.textContent = total;
    badgeCritical.textContent = critical;
    badgeHigh.textContent = high;
    badgeMedium.textContent = medium;
    badgeLow.textContent = low;
  }

  // Filter Logic
  function filterReportsList(list) {
    return list.filter(report => {
      const matchesFilter = activeFilter === "all" || report.predicted_urgency === activeFilter;
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        report.text.toLowerCase().includes(query) ||
        (report.address && report.address.toLowerCase().includes(query)) ||
        report.resources.toLowerCase().includes(query) ||
        report.report_id.toLowerCase().includes(query) ||
        report.explanation.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }

  // Render Incident Table
  function renderTable() {
    const filtered = filterReportsList(allReports);
    tableBody.innerHTML = "";

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">
            No emergency reports match the current filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(report => {
      const tr = document.createElement("tr");

      // Format resources tags
      const resourceList = report.resources !== "none" 
        ? report.resources.split(",").map(res => `<span class="resource-tag">${res.trim()}</span>`).join("")
        : `<span class="resource-tag" style="opacity: 0.5;">None needed</span>`;

      tr.innerHTML = `
        <td><strong>${report.report_id}</strong></td>
        <td style="color: #38bdf8; font-weight: 600; min-width: 160px;">📍 ${escapeHtml(report.address || "Mumbai")}</td>
        <td style="max-width: 260px; font-weight: 500;">${escapeHtml(report.text)}</td>
        <td><span class="urgency-badge ${report.predicted_urgency}">${report.predicted_urgency}</span></td>
        <td><div class="resource-tags">${resourceList}</div></td>
        <td><span class="cluster-pill">Cluster #${report.cluster_id}</span></td>
        <td><span class="explanation-text">${escapeHtml(report.explanation)}</span></td>
        <td>
          <button class="btn-agent" onclick="triggerAgentDispatch('${report.report_id}')">
            🤖 AI Plan
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // Helper: HTML escaping
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Handle Dispatcher Form Submission
  triageForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = reportTextInput.value.trim();
    const address = addressInput ? addressInput.value.trim() : "";
    const latitude = parseFloat(latitudeInput.value);
    const longitude = parseFloat(longitudeInput.value);

    if (!text || isNaN(latitude) || isNaN(longitude)) {
      alert("Please provide valid report text, latitude, and longitude.");
      return;
    }

    // Set Loading State
    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Running ML Inference & Clustering...";

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, address, latitude, longitude })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to submit triage report");
      }

      const resData = await response.json();
      const newReport = resData.report;

      // Reset Form & Temp Marker
      reportTextInput.value = "";
      if (addressInput) addressInput.value = "";
      latitudeInput.value = "";
      longitudeInput.value = "";
      if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
      }

      // Display Instant Results Banner
      triageResult.classList.remove("hidden");
      triageResult.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: #34d399;">✅ Incident Triaged & Dispatched Successfully</strong>
          <span class="urgency-badge ${newReport.predicted_urgency}">${newReport.predicted_urgency}</span>
        </div>
        <p style="font-size: 0.88rem; color: #cbd5e1; margin-bottom: 6px;"><strong>Report ID:</strong> ${newReport.report_id} &bull; <strong>Assigned Cluster:</strong> #${newReport.cluster_id}</p>
        <p style="font-size: 0.85rem; color: var(--text-muted);"><strong>Resources Extracted:</strong> ${newReport.resources} &bull; <strong>Keywords:</strong> ${newReport.explanation}</p>
      `;

      // Re-fetch state & update view
      await fetchReports();

      // Pan map to new report
      map.flyTo([latitude, longitude], 13, { duration: 1.5 });

    } catch (err) {
      alert("Error processing report: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = "Analyze & Triage Incident";
    }
  });

  // Filter Tabs Event Listeners
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.getAttribute("data-filter");
      updateUI();
    });
  });

  // Search Input Event Listener
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    updateUI();
  });

  // Modal Controls
  const agentModal = document.getElementById("agent-modal");
  const modalClose = document.getElementById("modal-close");
  const modalBody = document.getElementById("modal-body");
  const modalSubtitle = document.getElementById("modal-subtitle");

  if (modalClose) {
    modalClose.addEventListener("click", () => {
      agentModal.classList.add("hidden");
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === agentModal) {
      agentModal.classList.add("hidden");
    }
  });

  // Global trigger for AI Dispatch Agent
  window.triggerAgentDispatch = async function(reportId) {
    agentModal.classList.remove("hidden");
    modalSubtitle.textContent = `Analyzing incident ${reportId} & selecting optimal emergency hub...`;
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div class="status-dot" style="margin: 0 auto 16px auto; width: 16px; height: 16px; background: #a855f7; box-shadow: 0 0 15px #a855f7;"></div>
        <p style="font-family: var(--font-heading); font-size: 1.1rem; color: #f8fafc;">AI Dispatch Agent Thinking...</p>
        <p style="font-size: 0.85rem; margin-top: 6px;">Computing Haversine distances to regional trauma centers & emergency squads.</p>
      </div>
    `;

    try {
      const response = await fetch("/api/agent/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId })
      });

      if (!response.ok) throw new Error("Failed to generate dispatch plan");

      const data = await response.json();
      const plan = data.dispatch_plan;

      modalSubtitle.textContent = `Tactical Plan formulated for Incident ${plan.report_id} (${plan.urgency.toUpperCase()} Priority)`;

      const unitsHtml = plan.recommended_units.map(u => `<span class="resource-tag" style="background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.3); color: #e9d5ff;">${u}</span>`).join(" ");
      const stepsHtml = plan.tactical_instructions.map((step, idx) => `
        <li class="instruction-item">
          <span style="font-weight: 700; color: var(--accent-cyan); min-width: 20px;">${idx + 1}.</span>
          <span>${step}</span>
        </li>
      `).join("");

      modalBody.innerHTML = `
        <div class="dispatch-card-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">Primary Emergency Hub</span>
              <h4 style="font-family: var(--font-heading); font-size: 1.1rem; color: #38bdf8; margin-top: 2px;">${plan.primary_facility.name}</h4>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.8rem; color: var(--text-dim);">Proximity</span>
              <p style="font-weight: 700; color: #34d399;">${plan.distance_km} km away</p>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            <strong>Facility Type:</strong> ${plan.primary_facility.type.replace("_", " ").toUpperCase()} &bull; 
            <strong>Est. Arrival ETA:</strong> ~${plan.estimated_arrival_mins} mins
          </p>
        </div>

        <div>
          <h4 style="font-family: var(--font-heading); font-size: 0.95rem; color: var(--text-main); margin-bottom: 8px;">Recommended Deployment Units:</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">${unitsHtml}</div>
        </div>

        <div>
          <h4 style="font-family: var(--font-heading); font-size: 0.95rem; color: var(--text-main); margin-bottom: 8px;">Tactical Dispatch Directives:</h4>
          <ul class="instruction-list">${stepsHtml}</ul>
        </div>
      `;

    } catch (err) {
      modalBody.innerHTML = `<p style="color: #ef4444; text-align: center;">Error generating plan: ${err.message}</p>`;
    }
  };

  // Bootstrapping
  initMap();
  fetchReports();
});
