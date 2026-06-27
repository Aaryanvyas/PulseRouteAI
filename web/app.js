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

  let mapEngine = "maplibre"; // 'maplibre' or 'leaflet'
  let mapLibreMap = null;

  // Toggle 3D Perspective Button Listener
  let is3dMode = true;
  if (toggle3dBtn && mapWrapper) {
    toggle3dBtn.classList.add("active");
    toggle3dBtn.textContent = "🛰️ 3D Tactical Mode Active";

    toggle3dBtn.addEventListener("click", () => {
      is3dMode = !is3dMode;
      if (is3dMode) {
        mapWrapper.classList.add("mode-3d");
        toggle3dBtn.classList.add("active");
        toggle3dBtn.textContent = "🛰️ 3D Tactical Mode Active";
        if (mapLibreMap) mapLibreMap.easeTo({ pitch: 50, bearing: -20, duration: 1000 });
      } else {
        mapWrapper.classList.remove("mode-3d");
        toggle3dBtn.classList.remove("active");
        toggle3dBtn.textContent = "🛰️ Toggle 3D Mode";
        if (mapLibreMap) mapLibreMap.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      }
    });
  }

  const citySearchInput = document.getElementById("city-search-input");
  const myLocationBtn = document.getElementById("my-location-btn");

  // Initialize 3D GIS Map
  function initMap() {
    const defaultLat = 19.0800;
    const defaultLng = 72.8700;

    if (typeof maplibregl !== "undefined") {
      mapEngine = "maplibre";
      mapLibreMap = new maplibregl.Map({
        container: "map",
        style: {
          version: 8,
          sources: {
            "carto-dark": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              ],
              tileSize: 256
            }
          },
          layers: [{ id: "carto-dark-layer", type: "raster", source: "carto-dark", minzoom: 0, maxzoom: 22 }]
        },
        center: [defaultLng, defaultLat],
        zoom: 11.5,
        pitch: 48,
        bearing: -18,
        antialias: true
      });

      mapLibreMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");

      mapLibreMap.on("click", async (e) => {
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;
        handleMapClick(lat, lng);
      });

    } else {
      mapEngine = "leaflet";
      map = L.map("map", { zoomControl: true, attributionControl: false }).setView([defaultLat, defaultLng], 11);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd" }).addTo(map);
      map.on("click", (e) => handleMapClick(e.latlng.lat, e.latlng.lng));
    }

    // Attempt Browser Geolocation Auto-Detection
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          flyToCoordinate(uLat, uLng, 13);
        },
        () => { console.log("[PulseRoute GIS] Geolocation permission denied or unavailable, using regional center."); },
        { timeout: 5000 }
      );
    }
  }

  // Helper function to fly to any coordinate globally
  function flyToCoordinate(lat, lng, zoom = 13) {
    if (mapEngine === "maplibre" && mapLibreMap) {
      mapLibreMap.flyTo({ center: [lng, lat], zoom: zoom, pitch: 48, speed: 1.4 });
    } else if (map) {
      map.flyTo([lat, lng], zoom, { duration: 1.5 });
    }
  }

  const seedNearbyBtn = document.getElementById("seed-nearby-btn");

  // My Location Button Event Listener
  if (myLocationBtn) {
    myLocationBtn.addEventListener("click", () => {
      if (navigator.geolocation) {
        myLocationBtn.textContent = "⌛ Locating...";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const uLat = pos.coords.latitude;
            const uLng = pos.coords.longitude;
            flyToCoordinate(uLat, uLng, 13.5);
            myLocationBtn.textContent = "📍 My Location";
            handleMapClick(uLat, uLng);
          },
          (err) => {
            alert("Could not detect your exact location: " + err.message);
            myLocationBtn.textContent = "📍 My Location";
          }
        );
      }
    });
  }

  // Seed Nearby Incidents Event Listener
  if (seedNearbyBtn) {
    seedNearbyBtn.addEventListener("click", () => {
      let curLat = parseFloat(latitudeInput.value) || 19.0760;
      let curLng = parseFloat(longitudeInput.value) || 72.8777;
      seedIncidentsAroundCoordinate(curLat, curLng);
    });
  }

  async function seedIncidentsAroundCoordinate(centerLat, centerLng) {
    if (seedNearbyBtn) {
      seedNearbyBtn.disabled = true;
      seedNearbyBtn.textContent = "⚡ Generating Incidents...";
    }

    const scenarios = [
      { text: "Building structural crack and emergency evacuation required near local residential sector", urgencyHint: "critical" },
      { text: "Severe urban waterlogging and submerged roads, stranded vehicles needing rescue tow and clearance", urgencyHint: "high" },
      { text: "Electric transformer spark and localized power blackout in commercial district", urgencyHint: "medium" },
      { text: "Local emergency relief camp requesting extra clean drinking water and food packets by evening", urgencyHint: "high" }
    ];

    try {
      for (let i = 0; i < scenarios.length; i++) {
        // Generate random offset within ~2km radius
        const offsetLat = centerLat + (Math.random() - 0.5) * 0.03;
        const offsetLng = centerLng + (Math.random() - 0.5) * 0.03;

        let addr = `Sector ${i + 1}, Near Coordinates ${offsetLat.toFixed(4)}, ${offsetLng.toFixed(4)}`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${offsetLat}&lon=${offsetLng}&zoom=16`);
          if (res.ok) {
            const geoData = await res.json();
            if (geoData && geoData.display_name) {
              addr = geoData.display_name.split(",").slice(0, 3).join(",").trim();
            }
          }
        } catch (e) {}

        const reportText = `${scenarios[i].text} near ${addr}. Urgent assistance requested.`;

        await fetch("/api/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: reportText,
            address: addr,
            latitude: offsetLat,
            longitude: offsetLng
          })
        });
      }

      await fetchReports();
      flyToCoordinate(centerLat, centerLng, 13);
      alert(`Successfully generated and triaged ${scenarios.length} realistic emergency incidents near your target location!`);

    } catch (err) {
      alert("Error generating nearby incidents: " + err.message);
    } finally {
      if (seedNearbyBtn) {
        seedNearbyBtn.disabled = false;
        seedNearbyBtn.textContent = "⚡ Incidents Near Me";
      }
    }
  }

  // City Search Bar Event Listener
  if (citySearchInput) {
    let searchTimeout = null;
    citySearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        performCitySearch(citySearchInput.value.trim());
      }
    });
  }

  async function performCitySearch(query) {
    if (!query) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const target = results[0];
          const lat = parseFloat(target.lat);
          const lng = parseFloat(target.lon);
          flyToCoordinate(lat, lng, 12);
          handleMapClick(lat, lng);
        } else {
          alert(`City or location '${query}' not found.`);
        }
      }
    } catch (err) {
      console.warn("[PulseRoute GIS] City search error:", err);
    }
  }

  async function handleMapClick(lat, lng) {
    latitudeInput.value = lat.toFixed(4);
    longitudeInput.value = lng.toFixed(4);

    let resolvedAddr = `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
      if (res.ok) {
        const geoData = await res.json();
        if (geoData && geoData.display_name) {
          const parts = geoData.display_name.split(",");
          resolvedAddr = parts.slice(0, 4).join(",").trim();
        }
      }
    } catch (err) {
      console.warn("[PulseRoute GIS] Online reverse geocoding fallback");
    }

    if (addressInput) addressInput.value = resolvedAddr;

    const popupHtml = `
      <div style="font-family: var(--font-body); padding: 4px; max-width: 250px;">
        <strong style="color: #34d399; font-size: 0.88rem;">📍 3D Target Pin Captured</strong>
        <p style="font-size: 0.82rem; color: #cbd5e1; margin: 4px 0 8px 0; font-weight: 600;">${escapeHtml(resolvedAddr)}</p>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <button class="btn btn-primary" onclick="autoTriageAtLocation(${lat}, ${lng}, '${escapeHtml(resolvedAddr).replace(/'/g, "\\'")}')" style="width: 100%; padding: 7px 10px; font-size: 0.78rem; background: linear-gradient(135deg, #a855f7, #06b6d4);">
            ⚡ Auto-Generate Triage Report
          </button>
        </div>
      </div>
    `;

    if (mapEngine === "maplibre" && mapLibreMap) {
      if (tempMarker) tempMarker.remove();
      const el = document.createElement("div");
      el.className = "maplibre-3d-marker";
      el.style.backgroundColor = "#06b6d4";
      tempMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml)).addTo(mapLibreMap);
      tempMarker.togglePopup();
    } else if (map) {
      if (tempMarker) map.removeLayer(tempMarker);
      tempMarker = L.circleMarker([lat, lng], { radius: 9, fillColor: "#06b6d4", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9 }).addTo(map);
      tempMarker.bindPopup(popupHtml).openPopup();
    }
  }

  window.focusReportForm = function() {
    triageForm.scrollIntoView({ behavior: "smooth" });
    reportTextInput.focus();
  };

  window.autoTriageAtLocation = async function(lat, lon, addr) {
    const sampleEmergencyTexts = [
      `Flash flood water entered ground floor near ${addr}, residents stranded needing rescue boat and drinking water`,
      `Building structural crack and wall collapse reported near ${addr}, injured people trapped under debris`,
      `Transformer explosion and fire spreading near ${addr}, workers evacuated needing ambulance and power clearance`,
      `Fallen trees blocking main arterial road near ${addr}, heavy traffic gridlock and medical emergency delayed`,
      `Emergency shelter at ${addr} urgently requires food packets, clean water and medical supplies for evacuees`
    ];

    const randomText = sampleEmergencyTexts[Math.floor(Math.random() * sampleEmergencyTexts.length)];
    
    reportTextInput.value = randomText;
    latitudeInput.value = lat.toFixed(4);
    longitudeInput.value = lon.toFixed(4);
    if (addressInput) addressInput.value = addr;

    // Trigger triage submission
    triageForm.dispatchEvent(new Event("submit"));
  };

  // Render Map Markers in 3D / 2D
  function renderMapMarkers(reports) {
    if (mapEngine === "maplibre" && mapLibreMap) {
      mapMarkers.forEach(m => m.remove());
      mapMarkers = [];
      if (!reports || reports.length === 0) return;

      const bounds = new maplibregl.LngLatBounds();
      reports.forEach(report => {
        const color = urgencyColors[report.predicted_urgency] || "#94a3b8";
        const isCritical = report.predicted_urgency === "critical";

        const el = document.createElement("div");
        el.className = `maplibre-3d-marker ${report.predicted_urgency}`;
        el.style.backgroundColor = color;
        if (isCritical) {
          el.style.width = "24px";
          el.style.height = "24px";
        }

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

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([report.longitude, report.latitude])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml))
          .addTo(mapLibreMap);

        mapMarkers.push(marker);
        bounds.extend([report.longitude, report.latitude]);
      });

      if (reports.length > 0 && !tempMarker) {
        mapLibreMap.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      }

    } else if (map) {
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

    let text = reportTextInput.value.trim();
    let address = addressInput ? addressInput.value.trim() : "";
    let latitude = parseFloat(latitudeInput.value);
    let longitude = parseFloat(longitudeInput.value);

    if (isNaN(latitude) || isNaN(longitude)) {
      // Default to central Mumbai coordinate if unselected
      latitude = 19.0760;
      longitude = 72.8777;
      latitudeInput.value = latitude;
      longitudeInput.value = longitude;
    }

    if (!text) {
      const locName = address || `Coordinates ${latitude}, ${longitude}`;
      text = `Emergency distress report filed at ${locName}. Immediate medical assistance, evacuation team and supply dispatch requested.`;
      reportTextInput.value = text;
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
        if (mapEngine === "maplibre") tempMarker.remove();
        else if (map) map.removeLayer(tempMarker);
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
      if (mapEngine === "maplibre" && mapLibreMap) {
        mapLibreMap.flyTo({ center: [longitude, latitude], zoom: 14, pitch: 50, speed: 1.2 });
      } else if (map) {
        map.flyTo([latitude, longitude], 13, { duration: 1.5 });
      }

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
