/**
 * CIVICEYE AI - Defect Reporting Module (report.js)
 * Handles client validation, HTML5 Geolocation, file upload dropzone,
 * and fetch() submission to Flask API with generated Issue ID confirmation.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("report-form");
  const useLocationBtn = document.getElementById("btn-use-location");
  const imageInput = document.getElementById("image-upload-input");
  const dropzone = document.getElementById("image-dropzone");
  const previewImg = document.getElementById("image-preview");
  const previewContainer = document.getElementById("preview-container");
  const removeImageBtn = document.getElementById("btn-remove-image");

  // Geolocation Handler
  if (useLocationBtn) {
    useLocationBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        window.CivicEye.notify("Geolocation is not supported by your browser.", "error");
        return;
      }

      useLocationBtn.disabled = true;
      const originalText = useLocationBtn.textContent;
      useLocationBtn.textContent = "Acquiring GPS...";

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);

          document.getElementById("latitude-input").value = lat;
          document.getElementById("longitude-input").value = lon;

          window.CivicEye.notify(`GPS coordinates acquired: ${lat}, ${lon}`, "success");
          useLocationBtn.disabled = false;
          useLocationBtn.textContent = originalText;
        },
        (error) => {
          console.warn("Geolocation error:", error);
          let msg = "Could not retrieve GPS position.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. You can manually enter coordinates or address.";
          }
          window.CivicEye.notify(msg, "error");
          useLocationBtn.disabled = false;
          useLocationBtn.textContent = originalText;
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  // Image Upload & Drag-and-Drop
  if (dropzone && imageInput) {
    ["dragenter", "dragover"].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        imageInput.files = e.dataTransfer.files;
        handleFilePreview(e.dataTransfer.files[0]);
      }
    });

    imageInput.addEventListener("change", () => {
      if (imageInput.files && imageInput.files.length > 0) {
        handleFilePreview(imageInput.files[0]);
      }
    });
  }

  function handleFilePreview(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.CivicEye.notify("Please select a valid image file.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
      if (previewContainer) previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  if (removeImageBtn && imageInput) {
    removeImageBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      imageInput.value = "";
      if (previewImg) previewImg.src = "";
      if (previewContainer) previewContainer.style.display = "none";
    });
  }

  // Form Submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const issueType = document.getElementById("issue-type-select").value;
      const location = document.getElementById("location-input").value.trim();
      const description = document.getElementById("description-input").value.trim();
      const latitude = document.getElementById("latitude-input").value.trim();
      const longitude = document.getElementById("longitude-input").value.trim();
      const submitBtn = document.getElementById("submit-issue-btn");

      // 1. Validation
      if (!issueType) {
        window.CivicEye.notify("Please select an issue type.", "error");
        return;
      }
      if (!location) {
        window.CivicEye.notify("Please provide the location or address.", "error");
        document.getElementById("location-input").focus();
        return;
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append("issue_type", issueType);
      formData.append("location", location);
      formData.append("description", description);
      if (latitude) formData.append("latitude", latitude);
      if (longitude) formData.append("longitude", longitude);

      if (imageInput.files && imageInput.files[0]) {
        formData.append("image", imageInput.files[0]);
      }

      // UI Submitting state
      submitBtn.disabled = true;
      const origBtnHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = `<span>Processing with AI Auditor...</span>`;

      try {
        // 2. Send data to Flask using fetch()
        const response = await fetch("/api/issues", {
          method: "POST",
          body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to submit issue");
        }

        // 3. Display success and generated ID
        showSuccessView(result);

      } catch (err) {
        console.error("Submission failed:", err);
        window.CivicEye.notify(`Submission error: ${err.message}`, "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    });
  }

  // Report another issue button
  const reportAnotherBtn = document.getElementById("btn-report-another");
  if (reportAnotherBtn) {
    reportAnotherBtn.addEventListener("click", () => {
      document.getElementById("submission-success-card").style.display = "none";
      document.getElementById("report-form-card").style.display = "block";
      form.reset();
      if (previewContainer) previewContainer.style.display = "none";
      const submitBtn = document.getElementById("submit-issue-btn");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Submit Issue Report</span>`;
    });
  }
});

function showSuccessView(result) {
  const formCard = document.getElementById("report-form-card");
  const successCard = document.getElementById("submission-success-card");
  const idDisplay = document.getElementById("generated-issue-id");
  const aiDetailsDisplay = document.getElementById("ai-verification-details");
  const viewMapBtn = document.getElementById("btn-success-view-map");
  const viewTableBtn = document.getElementById("btn-success-view-table");

  if (formCard) formCard.style.display = "none";
  if (successCard) successCard.style.display = "block";

  if (idDisplay) idDisplay.textContent = result.issue_id;

  if (aiDetailsDisplay && result.ai_analysis) {
    const ai = result.ai_analysis;
    aiDetailsDisplay.innerHTML = `
      <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 6px; padding: 12px; margin-top: 12px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">
          Automated AI Defect Classification
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <span>Detected Type: <strong>${ai.issue_type}</strong></span>
          <span>Severity: <strong>${window.CivicEye.getSeverityBadge(ai.severity)}</strong></span>
        </div>
        <div style="font-size:0.85rem; color:var(--text-secondary);">
          Model Confidence: <strong>${Math.round(ai.confidence * 100)}%</strong>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">
          ${ai.details}
        </p>
      </div>
    `;
  }

  if (viewMapBtn && result.issue) {
    const lat = result.issue.latitude;
    const lon = result.issue.longitude;
    if (lat && lon) {
      viewMapBtn.href = `/map?lat=${lat}&lon=${lon}`;
      viewMapBtn.style.display = "inline-flex";
    } else {
      viewMapBtn.href = "/map";
    }
  }

  if (viewTableBtn) {
    viewTableBtn.href = `/issues?search=${encodeURIComponent(result.issue_id)}`;
  }

  window.CivicEye.notify(`Issue ${result.issue_id} logged into municipal registry.`, "success");
}
