/**
 * CIVICEYE AI - Issues Registry Module (issues.js)
 * Manages search, filter queries, modal defect viewing, and Admin status updates.
 */

let allIssues = [];
let currentViewingIssue = null;

document.addEventListener("DOMContentLoaded", () => {
  // Check URL query parameters for pre-filled search
  const urlParams = new URLSearchParams(window.location.search);
  const initialSearch = urlParams.get("search");
  if (initialSearch) {
    const searchInput = document.getElementById("issue-search");
    if (searchInput) searchInput.value = initialSearch;
  }

  // Load issues
  fetchIssues();

  // Setup event listeners for filters
  const searchInput = document.getElementById("issue-search");
  const severityFilter = document.getElementById("filter-severity");
  const statusFilter = document.getElementById("filter-status");
  const typeFilter = document.getElementById("filter-type");
  const clearFiltersBtn = document.getElementById("btn-clear-filters");

  if (searchInput) {
    searchInput.addEventListener("input", debounce(fetchIssues, 300));
  }
  if (severityFilter) severityFilter.addEventListener("change", fetchIssues);
  if (statusFilter) statusFilter.addEventListener("change", fetchIssues);
  if (typeFilter) typeFilter.addEventListener("change", fetchIssues);

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (severityFilter) severityFilter.value = "all";
      if (statusFilter) statusFilter.value = "all";
      if (typeFilter) typeFilter.value = "all";
      fetchIssues();
    });
  }

  // Setup modal close buttons
  const modalCloseBtns = document.querySelectorAll(".modal-close-trigger");
  modalCloseBtns.forEach(btn => {
    btn.addEventListener("click", closeModal);
  });

  // Setup modal admin update form
  const adminUpdateForm = document.getElementById("admin-update-form");
  if (adminUpdateForm) {
    adminUpdateForm.addEventListener("submit", handleAdminUpdate);
  }
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function fetchIssues() {
  const searchInput = document.getElementById("issue-search");
  const severityFilter = document.getElementById("filter-severity");
  const statusFilter = document.getElementById("filter-status");
  const typeFilter = document.getElementById("filter-type");
  const tableBody = document.getElementById("issues-table-body");
  const countBadge = document.getElementById("results-count-badge");

  const searchVal = searchInput ? searchInput.value.trim() : "";
  const severityVal = severityFilter ? severityFilter.value : "all";
  const statusVal = statusFilter ? statusFilter.value : "all";
  const typeVal = typeFilter ? typeFilter.value : "all";

  const params = new URLSearchParams();
  if (searchVal) params.append("search", searchVal);
  if (severityVal && severityVal !== "all") params.append("severity", severityVal);
  if (statusVal && statusVal !== "all") params.append("status", statusVal);
  if (typeVal && typeVal !== "all") params.append("issue_type", typeVal);

  try {
    const res = await fetch(`/api/issues?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch issues");
    const data = await res.json();
    allIssues = data.issues || [];

    if (countBadge) {
      countBadge.textContent = `${allIssues.length} issue${allIssues.length === 1 ? '' : 's'} found`;
    }

    renderTable(allIssues);
  } catch (err) {
    console.error("Error loading issues:", err);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 2rem; color: #ef4444;">
            Failed to load issues from server.
          </td>
        </tr>
      `;
    }
  }
}

function renderTable(issues) {
  const tableBody = document.getElementById("issues-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (issues.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">
          No matching civic issues found with current filters.
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
      <td><strong>${issue.issue_id}</strong></td>
      <td>
        <span style="font-weight:600; color:var(--text-primary);">${issue.issue_type}</span>
      </td>
      <td>
        <span title="${issue.location}">${truncate(issue.location, 34)}</span>
      </td>
      <td>${severityBadge}</td>
      <td>${statusBadge}</td>
      <td style="white-space:nowrap;">${formattedDate}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm btn-outline btn-view-issue" data-id="${issue.issue_id}">
          View
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // Attach view listeners
  document.querySelectorAll(".btn-view-issue").forEach(btn => {
    btn.addEventListener("click", () => {
      const issueId = btn.getAttribute("data-id");
      openIssueDetailModal(issueId);
    });
  });
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

async function openIssueDetailModal(issueId) {
  const modal = document.getElementById("issue-modal");
  if (!modal) return;

  try {
    const res = await fetch(`/api/issues/${issueId}`);
    if (!res.ok) throw new Error("Issue not found");
    const issue = await res.json();
    currentViewingIssue = issue;

    // Populate modal data
    document.getElementById("modal-issue-id").textContent = issue.issue_id;
    document.getElementById("modal-issue-type").textContent = issue.issue_type;
    document.getElementById("modal-location").textContent = issue.location;
    document.getElementById("modal-description").textContent = issue.description || "No additional description provided.";
    document.getElementById("modal-date").textContent = window.CivicEye.formatDate(issue.created_at);
    document.getElementById("modal-updated").textContent = window.CivicEye.formatDate(issue.updated_at);
    
    // Badges
    document.getElementById("modal-severity-badge").innerHTML = window.CivicEye.getSeverityBadge(issue.severity);
    document.getElementById("modal-status-badge").innerHTML = window.CivicEye.getStatusBadge(issue.status);

    // AI Confidence & Defect Analysis
    const confVal = Math.round((issue.ai_confidence || 0.90) * 100);
    document.getElementById("modal-ai-confidence").textContent = `${confVal}%`;

    // Coordinates
    const coordsEl = document.getElementById("modal-coords");
    if (issue.latitude && issue.longitude) {
      coordsEl.innerHTML = `
        <span style="font-family:monospace; font-weight:600;">${issue.latitude}, ${issue.longitude}</span>
        <a href="/map?lat=${issue.latitude}&lon=${issue.longitude}" class="btn btn-sm btn-outline" style="margin-left:8px; padding:2px 8px;">
          Show on Map
        </a>
      `;
    } else {
      coordsEl.innerHTML = `<span style="color:var(--text-muted); font-style:italic;">No GPS coordinates available</span>`;
    }

    // Image
    const imgEl = document.getElementById("modal-image");
    if (imgEl) {
      imgEl.src = issue.image_path || "/static/img/demo_pothole.svg";
      imgEl.alt = `${issue.issue_type} photo`;
    }

    // Admin Controls visibility & select inputs
    const adminPanel = document.getElementById("modal-admin-panel");
    const statusSelect = document.getElementById("admin-select-status");
    const severitySelect = document.getElementById("admin-select-severity");

    if (statusSelect) statusSelect.value = issue.status;
    if (severitySelect) severitySelect.value = issue.severity;

    // If authenticated admin, show the edit inputs
    if (adminPanel) {
      if (window.CivicEye.isAuthenticated) {
        adminPanel.style.display = "block";
      } else {
        adminPanel.style.display = "block"; // Always visible in demo, but styled as auditor tools
      }
    }

    // Open modal
    modal.classList.add("active");
  } catch (err) {
    console.error("Error loading issue detail:", err);
    window.CivicEye.notify("Failed to load issue details.", "error");
  }
}

function closeModal() {
  const modal = document.getElementById("issue-modal");
  if (modal) modal.classList.remove("active");
  currentViewingIssue = null;
}

async function handleAdminUpdate(e) {
  e.preventDefault();
  if (!currentViewingIssue) return;

  const statusSelect = document.getElementById("admin-select-status");
  const severitySelect = document.getElementById("admin-select-severity");

  const newStatus = statusSelect.value;
  const newSeverity = severitySelect.value;

  try {
    const res = await fetch(`/api/issues/${currentViewingIssue.issue_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        severity: newSeverity
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");

    window.CivicEye.notify(`Issue ${currentViewingIssue.issue_id} updated to ${newStatus} (${newSeverity}).`, "success");
    closeModal();
    fetchIssues();
  } catch (err) {
    console.error("Failed to update issue:", err);
    window.CivicEye.notify(`Error updating issue: ${err.message}`, "error");
  }
}
