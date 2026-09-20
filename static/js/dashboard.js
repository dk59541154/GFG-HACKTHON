/**
 * CIVICEYE AI - Dashboard Module (dashboard.js)
 * Fetches metrics dynamically from /api/dashboard and populates stats,
 * health indicator, 7-day detection trend, and recent issues table.
 */

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();

  // Reset Demo Data action
  const resetDemoBtn = document.getElementById("reset-demo-btn");
  if (resetDemoBtn) {
    resetDemoBtn.addEventListener("click", async () => {
      if (!confirm("Reset database to standard civic demo issues?")) return;
      try {
        const res = await fetch("/api/reset-demo", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          window.CivicEye.notify("Demo data reloaded.", "success");
          loadDashboardData();
        }
      } catch (err) {
        window.CivicEye.notify("Failed to reset demo data.", "error");
      }
    });
  }

  // Clear All action
  const clearDemoBtn = document.getElementById("clear-demo-btn");
  if (clearDemoBtn) {
    clearDemoBtn.addEventListener("click", async () => {
      if (!confirm("Clear ALL issues from the database? This is useful for testing fresh reporting.")) return;
      try {
        const res = await fetch("/api/clear-demo", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          window.CivicEye.notify("All issues cleared from database.", "info");
          loadDashboardData();
        }
      } catch (err) {
        window.CivicEye.notify("Failed to clear data.", "error");
      }
    });
  }
});

async function loadDashboardData() {
  const loadingIndicator = document.getElementById("dashboard-loading");
  if (loadingIndicator) loadingIndicator.style.display = "block";

  try {
    const response = await fetch("/api/dashboard");
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const data = await response.json();

    // 1. Update metric cards
    document.getElementById("stat-total").textContent = data.total;
    document.getElementById("stat-critical").textContent = data.critical;
    document.getElementById("stat-inprogress").textContent = data.in_progress;
    document.getElementById("stat-resolved").textContent = data.resolved;

    // 2. Update Infrastructure Health Section
    updateHealthSection(data.health, data.health_status, data.unresolved_critical_or_high, data.total);

    // 3. Update 7-Day Trend Chart
    renderTrendChart(data.trend || []);

    // 4. Update Recent Issues Table
    renderRecentIssues(data.recent_issues || []);

    // 5. Update category breakdown if element exists
    renderCategoryBreakdown(data.type_breakdown || {});

  } catch (error) {
    console.error("Error loading dashboard metrics:", error);
    window.CivicEye.notify("Failed to load live metrics from Flask API.", "error");
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

function updateHealthSection(healthPct, healthStatus, unresolvedCount, total) {
  const healthValueEl = document.getElementById("health-percentage");
  const healthStatusEl = document.getElementById("health-status-badge");
  const healthBarFill = document.getElementById("health-bar-fill");
  const healthExplanation = document.getElementById("health-explanation");

  if (healthValueEl) healthValueEl.textContent = `${healthPct}%`;

  if (healthBarFill) {
    healthBarFill.style.width = `${healthPct}%`;
    healthBarFill.className = "health-bar-fill"; // reset
    if (healthPct < 50) {
      healthBarFill.classList.add("critical");
    } else if (healthPct < 80) {
      healthBarFill.classList.add("moderate");
    }
  }

  if (healthStatusEl) {
    healthStatusEl.textContent = healthStatus;
    healthStatusEl.className = "badge";
    if (healthStatus === "Healthy") {
      healthStatusEl.classList.add("badge-status-resolved");
    } else if (healthStatus === "Moderate") {
      healthStatusEl.classList.add("badge-medium");
    } else {
      healthStatusEl.classList.add("badge-critical");
    }
  }

  if (healthExplanation) {
    healthExplanation.textContent = total === 0
      ? "No municipal defects logged. Network is fully operational."
      : `${unresolvedCount} unresolved critical/high defect(s) currently impacting municipal road safety.`;
  }
}

function renderTrendChart(trendData) {
  const chartContainer = document.getElementById("trend-chart");
  if (!chartContainer) return;

  chartContainer.innerHTML = "";

  if (trendData.length === 0) {
    chartContainer.innerHTML = "<p class='text-muted' style='margin:auto;'>No trend data available.</p>";
    return;
  }

  // Determine max value for proportional heights
  const maxVal = Math.max(...trendData.map(d => d.count), 1);

  trendData.forEach(item => {
    const col = document.createElement("div");
    col.className = "trend-col";

    const barWrapper = document.createElement("div");
    barWrapper.className = "trend-bar-wrapper";

    const bar = document.createElement("div");
    bar.className = "trend-bar";
    
    // Scale height between min 6px and 120px
    const heightPx = item.count === 0 ? 6 : Math.round((item.count / maxVal) * 110) + 12;
    bar.style.height = `${heightPx}px`;

    const tooltip = document.createElement("span");
    tooltip.className = "trend-tooltip";
    tooltip.textContent = item.count;

    bar.appendChild(tooltip);
    barWrapper.appendChild(bar);

    const dateLabel = document.createElement("span");
    dateLabel.className = "trend-date";
    dateLabel.textContent = item.label;

    col.appendChild(barWrapper);
    col.appendChild(dateLabel);

    chartContainer.appendChild(col);
  });
}

function renderRecentIssues(issues) {
  const tableBody = document.getElementById("recent-issues-body");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (issues.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">
          No issues recorded in database. Click "Report Issue" to log the first defect.
        </td>
      </tr>
    `;
    return;
  }

  issues.forEach(issue => {
    const row = document.createElement("tr");

    const formattedDate = window.CivicEye.formatDate(issue.created_at);
    const severityBadge = window.CivicEye.getSeverityBadge(issue.severity);
    const statusBadge = window.CivicEye.getStatusBadge(issue.status);

    row.innerHTML = `
      <td><a href="/issues?search=${encodeURIComponent(issue.issue_id)}" class="issue-id-link">${issue.issue_id}</a></td>
      <td><strong>${issue.issue_type}</strong></td>
      <td>${issue.location}</td>
      <td>${severityBadge}</td>
      <td>${statusBadge}</td>
      <td style="white-space:nowrap;">${formattedDate}</td>
    `;
    tableBody.appendChild(row);
  });
}

function renderCategoryBreakdown(breakdown) {
  const container = document.getElementById("type-breakdown-container");
  if (!container) return;

  const entries = Object.entries(breakdown);
  if (entries.length === 0) {
    container.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem;'>No data available.</p>";
    return;
  }

  const total = entries.reduce((acc, [_, count]) => acc + count, 0);

  let html = `<div style="display:flex; flex-direction:column; gap:8px;">`;
  entries.forEach(([type, count]) => {
    const pct = Math.round((count / total) * 100);
    html += `
      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:2px;">
          <span>${type}</span>
          <span style="font-weight:700;">${count} (${pct}%)</span>
        </div>
        <div style="background-color:var(--border-light); height:6px; border-radius:3px; overflow:hidden;">
          <div style="background-color:var(--accent-blue); width:${pct}%; height:100%;"></div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}
