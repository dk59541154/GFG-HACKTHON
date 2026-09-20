# CIVICEYE AI - Smart Road & Infrastructure Auditor

> **Tagline:** Detect → Locate → Verify → Prioritize → Track

CivicEye AI is an AI-powered municipal civic infrastructure monitoring platform that detects and manages road and infrastructure hazards such as potholes, road cracks, damaged traffic signals, damaged signs, and broken streetlights.

---

## Technical Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), Leaflet.js
- **Backend:** Python 3, Flask (REST API, Jinja2 template rendering, Session Auth)
- **Database:** SQLite 3 (`civic_eye.db` with parameterized queries)
- **AI Defect Detection:** Modular `ai_detector.py` rule-based anomaly detector with computer vision adapter hooks for future YOLOv8 / PyTorch integration.

---

## File Structure

```
CivicEye_AI/
│
├── app.py                  # Main Flask application & REST API routes
├── database.py             # SQLite setup, schemas, migrations, demo seeder
├── ai_detector.py          # Modular defect analyzer (rule-based & vision ready)
├── requirements.txt        # Python backend dependencies
├── civic_eye.db            # SQLite persistent database file
│
├── templates/              # Jinja2 HTML templates
│   ├── base.html           # Layout with official municipal navigation & footer
│   ├── index.html          # Landing page with workflow and capabilities
│   ├── dashboard.html      # Real-time SQLite dashboard with 7-day trend
│   ├── issues.html         # Searchable, filterable issue registry with modal
│   ├── map.html            # Geospatial GPS defect mapping
│   ├── report.html         # Citizen & inspector defect reporting form
│   └── login.html          # Secure administrative authentication portal
│
├── static/
│   ├── css/
│   │   └── style.css       # Clean government/smart-city design system
│   ├── js/
│   │   ├── app.js          # Global app controller, auth state & notifications
│   │   ├── dashboard.js    # Dynamic metrics, health index & trend visualizer
│   │   ├── issues.js       # Search, filter, modal viewer & inspector actions
│   │   ├── map.js          # GPS pin rendering & interactive Leaflet viewer
│   │   └── report.js       # Geolocation, file dropzone & fetch() submission
│   ├── img/                # High-fidelity SVG defect graphics
│   └── uploads/            # Citizen & inspector uploaded photos
│
└── README.md
```

---

## Features

1. **Dynamic Dashboard:**
   - Real-time counts: Total Issues, Critical Issues, In Progress, Resolved.
   - **Infrastructure Health Index:** Formula: `Health % = 100 - % of unresolved critical/high severity issues`. Clean progress bar indicating Healthy (&ge;80%), Moderate (50-79%), or Critical (&lt;50%).
   - **Issue Detection Trend:** JavaScript 7-day bar chart showing recent detection frequency.
   - **Recent Issues:** Latest records pulled directly from SQLite.

2. **Searchable & Filterable Issue Table:**
   - Real-time search across Issue ID, Location, and Description.
   - Filters for Severity (Critical, High, Medium, Low), Status (Reported, Verified, In Progress, Resolved), and Type (Pothole, Road Crack, Damaged Signal, Damaged Sign, Broken Streetlight, Other).
   - "View" modal showing details, GPS coordinates, timestamps, and uploaded images.
   - Admin action tools to update defect status and severity.

3. **Defect Reporting & Image Upload:**
   - Real report form with HTML5 "Use My Location" geolocation.
   - Drag-and-drop defect photo upload saved to `static/uploads/`.
   - Generates sequential IDs (`CE-001`, `CE-002`).
   - Runs AI Defect Detector to evaluate severity and confidence score.

4. **Spatial GPS Map:**
   - Interactive Leaflet map displaying real coordinates from SQLite.
   - Color-coded severity pins (Red for Critical, Orange for High, Amber for Medium, Blue for Low).
   - Popups with defect information and navigation links.

5. **Demo Admin Authentication:**
   - Credentials: `admin@civiceye.gov` / `admin123` (hashed with SHA-256 in SQLite).
   - Grants inspector verification and status remediation rights.

---

## Local Setup & Execution

1. Clone or extract the project directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Flask application:
   ```bash
   python app.py
   ```
4. Access the web portal in your browser at `http://localhost:5000` (or configured port).
