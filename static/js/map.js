/**
 * CIVICEYE AI - Spatial Infrastructure Map (map.js)
 * Visualizes SQLite issues with real GPS coordinates using Leaflet & OpenStreetMap tiles.
 */

let mapInstance = null;
let markersGroup = null;
let mapIssues = [];

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadMapIssues();
});

function initMap() {
  const mapContainer = document.getElementById("civic-map");
  if (!mapContainer) return;

  // Default coordinate center (Downtown Civic District)
  const defaultLat = 37.7749;
  const defaultLon = -122.4194;

  try {
    // Check if Leaflet L is available
    if (typeof L !== "undefined") {
      mapInstance = L.map("civic-map").setView([defaultLat, defaultLon], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CIVICEYE AI',
        maxZoom: 19
      }).addTo(mapInstance);

      markersGroup = L.featureGroup().addTo(mapInstance);
    } else {
      showMapFallback();
    }
  } catch (e) {
    console.error("Leaflet init error:", e);
    showMapFallback();
  }
}

async function loadMapIssues() {
  try {
    const res = await fetch("/api/issues");
    if (!res.ok) throw new Error("Could not fetch issues for map");
    const data = await res.json();
    mapIssues = data.issues || [];

    renderMapMarkers(mapIssues);
    renderMapSidebar(mapIssues);

    // Check if URL has lat/lon to focus
    const urlParams = new URLSearchParams(window.location.search);
    const targetLat = parseFloat(urlParams.get("lat"));
    const targetLon = parseFloat(urlParams.get("lon"));

    if (mapInstance && !isNaN(targetLat) && !isNaN(targetLon)) {
      mapInstance.setView([targetLat, targetLon], 16);
    }
  } catch (err) {
    console.error("Map loading error:", err);
    window.CivicEye.notify("Failed to load map issue markers.", "error");
  }
}

function getMarkerIcon(severity) {
  const colorMap = {
    "Critical": "#dc2626",
    "High": "#ea580c",
    "Medium": "#d97706",
    "Low": "#2563eb"
  };
  const color = colorMap[severity] || "#2563eb";

  // SVG Custom Pin
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="28" height="36">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="11" r="5" fill="#ffffff"/>
      <circle cx="12" cy="11" r="3" fill="${color}"/>
    </svg>
  `;

  return L.divIcon({
    className: "custom-map-pin",
    html: svgIcon,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32]
  });
}

function renderMapMarkers(issues) {
  if (!mapInstance || !markersGroup) return;

  markersGroup.clearLayers();
  const validCoordinates = [];

  issues.forEach(issue => {
    if (issue.latitude && issue.longitude) {
      const lat = parseFloat(issue.latitude);
      const lon = parseFloat(issue.longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        validCoordinates.push([lat, lon]);

        const marker = L.marker([lat, lon], {
          icon: getMarkerIcon(issue.severity)
        });

        const sevBadge = window.CivicEye.getSeverityBadge(issue.severity);
        const statBadge = window.CivicEye.getStatusBadge(issue.status);

        const popupContent = `
          <div style="font-family:var(--font-family); min-width:210px; padding:4px;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--accent-blue); margin-bottom:2px;">
              ${issue.issue_id}
            </div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
              ${issue.issue_type}
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">
              ${issue.location}
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px;">
              ${sevBadge}
              ${statBadge}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:6px; margin-top:6px;">
              <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">
                ${lat.toFixed(4)}, ${lon.toFixed(4)}
              </span>
              <a href="/issues?search=${encodeURIComponent(issue.issue_id)}" class="btn btn-sm btn-primary" style="padding:2px 8px; font-size:0.75rem;">
                Details
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        markersGroup.addLayer(marker);
      }
    }
  });

  // Fit bounds if markers exist and no specific URL search parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get("lat") && validCoordinates.length > 0) {
    mapInstance.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
  }
}

function renderMapSidebar(issues) {
  const listContainer = document.getElementById("map-issue-list");
  const countEl = document.getElementById("map-count-badge");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  const mapped = issues.filter(i => i.latitude && i.longitude);
  const unmapped = issues.filter(i => !i.latitude || !i.longitude);

  if (countEl) {
    countEl.textContent = `${mapped.length} Geocoded / ${issues.length} Total`;
  }

  if (issues.length === 0) {
    listContainer.innerHTML = `<p style="padding:1rem; color:var(--text-muted); font-size:0.85rem;">No issues recorded.</p>`;
    return;
  }

  // Render Mapped Issues
  mapped.forEach(issue => {
    const item = document.createElement("div");
    item.className = "map-list-item";
    item.style.cssText = "padding: 10px 12px; border-bottom: 1px solid var(--border-light); cursor: pointer; transition: background 0.15s ease;";
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-weight:700; font-size:0.85rem; color:var(--accent-blue);">${issue.issue_id}</span>
        ${window.CivicEye.getSeverityBadge(issue.severity)}
      </div>
      <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary); margin-bottom:2px;">
        ${issue.issue_type}
      </div>
      <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
        ${issue.location}
      </div>
      <div style="font-size:0.75rem; color:var(--text-secondary); font-family:monospace;">
        GPS: ${parseFloat(issue.latitude).toFixed(4)}, ${parseFloat(issue.longitude).toFixed(4)}
      </div>
    `;

    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = "var(--bg-hover)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor = "transparent";
    });

    item.addEventListener("click", () => {
      if (mapInstance) {
        mapInstance.setView([parseFloat(issue.latitude), parseFloat(issue.longitude)], 16);
      }
    });

    listContainer.appendChild(item);
  });

  // Render unmapped notice if any
  if (unmapped.length > 0) {
    const unmappedHeader = document.createElement("div");
    unmappedHeader.style.cssText = "padding:8px 12px; background-color:#fff7ed; border-bottom:1px solid #fed7aa; font-size:0.75rem; font-weight:700; color:#c2410c;";
    unmappedHeader.textContent = `Location Unavailable (${unmapped.length} issues without GPS)`;
    listContainer.appendChild(unmappedHeader);

    unmapped.forEach(issue => {
      const item = document.createElement("div");
      item.style.cssText = "padding: 8px 12px; border-bottom: 1px solid var(--border-light); background-color:#fafaf9;";
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <span style="font-weight:700; font-size:0.8rem; color:var(--text-muted);">${issue.issue_id}</span>
          <span class="badge" style="background-color:#fee2e2; color:#991b1b; font-size:0.7rem;">No GPS</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${issue.issue_type} - ${issue.location}</div>
      `;
      listContainer.appendChild(item);
    });
  }
}

function showMapFallback() {
  const container = document.getElementById("civic-map");
  if (container) {
    container.innerHTML = `
      <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background-color:var(--bg-subtle); color:var(--text-secondary); padding:2rem; text-align:center;">
        <h3 style="margin-bottom:0.5rem;">Interactive Map Initializing...</h3>
        <p style="font-size:0.9rem; max-width:400px; color:var(--text-muted);">
          Leaflet map tiles are rendering coordinates directly from SQLite database records.
        </p>
      </div>
    `;
  }
}
