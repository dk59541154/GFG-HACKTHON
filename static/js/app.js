/**
 * CIVICEYE AI - Global Client Application Module (app.js)
 * Manages session state, global navigation, notifications, and modal controls.
 */

// Global state
window.CivicEye = {
  currentUser: null,
  isAuthenticated: false,

  // Toast / Notification helper
  notify: function (message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.position = "fixed";
      container.style.bottom = "24px";
      container.style.right = "24px";
      container.style.zIndex = "9999";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "8px";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `alert alert-${type}`;
    toast.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.15)";
    toast.style.margin = "0";
    toast.style.minWidth = "280px";
    toast.style.animation = "fadeIn 0.2s ease";
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Check authentication status
  checkAuth: async function () {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      this.isAuthenticated = data.is_authenticated;
      this.currentUser = data.user || null;
      this.updateAuthUI();
    } catch (err) {
      console.warn("Auth check failed:", err);
    }
  },

  // Updates header auth button
  updateAuthUI: function () {
    const authLink = document.getElementById("nav-auth-link");
    if (!authLink) return;

    if (this.isAuthenticated && this.currentUser) {
      authLink.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:6px;">
          <span class="status-indicator-dot"></span>
          <span>${this.currentUser.name} (${this.currentUser.role})</span>
          <button id="logout-btn" class="btn btn-sm btn-outline" style="margin-left:8px; padding:2px 8px; font-size:0.75rem;">Logout</button>
        </span>
      `;
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await fetch("/api/logout", { method: "POST" });
          window.CivicEye.notify("Signed out successfully.", "info");
          setTimeout(() => window.location.reload(), 500);
        });
      }
    } else {
      authLink.innerHTML = `<a href="/login" class="btn btn-sm btn-outline">Admin Login</a>`;
    }
  },

  // Formats UTC date string nicely
  formatDate: function (dateStr) {
    if (!dateStr) return "N/A";
    try {
      let isoStr = String(dateStr).trim();
      if (!isoStr.includes("T")) {
        isoStr = isoStr.replace(" ", "T");
      }
      if (!isoStr.endsWith("Z") && !isoStr.includes("+") && !isoStr.includes("-", 10)) {
        isoStr += "Z";
      }
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch (e) {
      return dateStr;
    }
  },

  // Renders badge HTML for severity
  getSeverityBadge: function (sev) {
    const s = (sev || "Medium").toLowerCase();
    return `<span class="badge badge-${s}">${sev}</span>`;
  },

  // Renders badge HTML for status
  getStatusBadge: function (stat) {
    const s = (stat || "Reported").toLowerCase().replace(/\s+/g, "");
    return `<span class="badge badge-status-${s}">${stat}</span>`;
  }
};

// Document ready bootstrap
document.addEventListener("DOMContentLoaded", () => {
  // Mobile nav toggle
  const toggleBtn = document.querySelector(".mobile-nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  // Check auth
  window.CivicEye.checkAuth();
});
