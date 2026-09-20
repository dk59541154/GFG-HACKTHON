"""
CIVICEYE AI - Smart Road & Infrastructure Auditor
Main Flask Web Application & REST API Server
"""

import os
import re
from datetime import datetime, timedelta
from flask import (
    Flask, render_template, request, jsonify, session,
    redirect, url_for, send_from_directory
)
from werkzeug.utils import secure_filename

import database
from ai_detector import analyze_defect

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/static"
)

# Secret key for session authentication
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "civiceye-secret-key-prod-2026-audit")

# Configuration for image uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "svg"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Ensure database is initialized on server startup
database.init_db(seed_demo=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ---------------------------------------------------------
# HTML PAGE ROUTES
# ---------------------------------------------------------

@app.route("/")
def page_home():
    """Home landing page with civic mission, features, and workflow."""
    return render_template("index.html", current_page="home")


@app.route("/dashboard")
def page_dashboard():
    """Live infrastructure monitoring dashboard connected to SQLite."""
    return render_template("dashboard.html", current_page="dashboard")


@app.route("/issues")
def page_issues():
    """Searchable, filterable municipal defect registry."""
    return render_template("issues.html", current_page="issues")


@app.route("/map")
def page_map():
    """Interactive GPS spatial auditor map."""
    return render_template("map.html", current_page="map")


@app.route("/report")
def page_report():
    """Citizen and inspector defect reporting interface."""
    return render_template("report.html", current_page="report")


@app.route("/login")
def page_login():
    """Inspector & Administrator authentication portal."""
    return render_template("login.html", current_page="login")


# ---------------------------------------------------------
# REST API ENDPOINTS
# ---------------------------------------------------------

@app.route("/api/dashboard", methods=["GET"])
def api_dashboard():
    """
    Computes and returns dynamic dashboard metrics from SQLite.
    Includes health percentage, counts, 7-day trend, and recent issues.
    """
    conn = database.get_db_connection()
    cursor = conn.cursor()

    # 1. Status and Severity counts
    cursor.execute("SELECT COUNT(*) as count FROM issues")
    total = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM issues WHERE severity = 'Critical' AND status != 'Resolved'")
    critical = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM issues WHERE status = 'In Progress'")
    in_progress = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM issues WHERE status = 'Resolved'")
    resolved = cursor.fetchone()["count"]

    # 2. Infrastructure Health calculation:
    # Health % = 100 - percentage of unresolved critical/high severity issues
    cursor.execute("""
        SELECT COUNT(*) as count FROM issues 
        WHERE severity IN ('Critical', 'High') AND status != 'Resolved'
    """)
    unresolved_high_or_crit = cursor.fetchone()["count"]

    if total == 0:
        health = 100
    else:
        unresolved_pct = (unresolved_high_or_crit / total) * 100.0
        health = max(0, min(100, int(round(100 - unresolved_pct))))

    if health >= 80:
        health_status = "Healthy"
    elif health >= 50:
        health_status = "Moderate"
    else:
        health_status = "Critical"

    # 3. Recent 6 issues
    cursor.execute("""
        SELECT issue_id, issue_type, description, location, latitude, longitude,
               severity, status, image_path, ai_confidence, created_at
        FROM issues
        ORDER BY created_at DESC, id DESC
        LIMIT 6
    """)
    recent_rows = cursor.fetchall()
    recent_issues = [dict(row) for row in recent_rows]

    # 4. Issue Detection Trend for the last 7 days
    trend = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_label = day.strftime("%b %d")
        cursor.execute("""
            SELECT COUNT(*) as count FROM issues 
            WHERE created_at LIKE ?
        """, (f"{day_str}%",))
        cnt = cursor.fetchone()["count"]
        trend.append({
            "date": day_str,
            "label": day_label,
            "count": cnt
        })

    # 5. Type distribution breakdown for analytics
    cursor.execute("SELECT issue_type, COUNT(*) as count FROM issues GROUP BY issue_type")
    type_rows = cursor.fetchall()
    type_breakdown = {row["issue_type"]: row["count"] for row in type_rows}

    # 6. Severity distribution breakdown
    cursor.execute("SELECT severity, COUNT(*) as count FROM issues GROUP BY severity")
    sev_rows = cursor.fetchall()
    severity_breakdown = {row["severity"]: row["count"] for row in sev_rows}

    conn.close()

    return jsonify({
        "total": total,
        "critical": critical,
        "in_progress": in_progress,
        "resolved": resolved,
        "unresolved_critical_or_high": unresolved_high_or_crit,
        "health": health,
        "health_status": health_status,
        "recent_issues": recent_issues,
        "trend": trend,
        "type_breakdown": type_breakdown,
        "severity_breakdown": severity_breakdown
    })


@app.route("/api/issues", methods=["GET"])
def api_get_issues():
    """
    Searchable, filterable list of all issues with coordinates, images, and AI confidence.
    Query parameters: search, severity, status, issue_type
    """
    search = request.args.get("search", "").strip()
    severity = request.args.get("severity", "").strip()
    status = request.args.get("status", "").strip()
    issue_type = request.args.get("issue_type", "").strip()

    query = """
        SELECT id, issue_id, issue_type, description, location, latitude, longitude,
               severity, status, image_path, ai_confidence, is_demo, created_at, updated_at
        FROM issues
        WHERE 1=1
    """
    params = []

    if search:
        query += " AND (issue_id LIKE ? OR location LIKE ? OR description LIKE ?)"
        like_term = f"%{search}%"
        params.extend([like_term, like_term, like_term])

    if severity and severity.lower() != "all":
        query += " AND severity = ?"
        params.append(severity)

    if status and status.lower() != "all":
        query += " AND status = ?"
        params.append(status)

    if issue_type and issue_type.lower() != "all":
        query += " AND issue_type = ?"
        params.append(issue_type)

    query += " ORDER BY created_at DESC, id DESC"

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    issues = [dict(row) for row in rows]
    conn.close()

    return jsonify({"issues": issues, "count": len(issues)})


@app.route("/api/issues/<issue_id>", methods=["GET"])
def api_get_issue_detail(issue_id):
    """Returns a single issue record by its public CE-XXX identifier."""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM issues WHERE issue_id = ?
    """, (issue_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": f"Issue '{issue_id}' not found."}), 404

    return jsonify(dict(row))


@app.route("/api/issues", methods=["POST"])
def api_create_issue():
    """
    Creates a new municipal infrastructure defect record.
    Accepts multipart/form-data (with file upload) or JSON.
    Runs AI defect detector, generates unique sequential CE-XXX ID, saves to SQLite.
    """
    is_form = bool(request.form)
    
    # Extract fields
    if is_form:
        issue_type = request.form.get("issue_type", "").strip()
        location = request.form.get("location", "").strip()
        description = request.form.get("description", "").strip()
        lat_raw = request.form.get("latitude", "").strip()
        lon_raw = request.form.get("longitude", "").strip()
        manual_severity = request.form.get("severity", "").strip()
    else:
        data = request.get_json(silent=True) or {}
        issue_type = data.get("issue_type", "").strip()
        location = data.get("location", "").strip()
        description = data.get("description", "").strip()
        lat_raw = str(data.get("latitude", "")).strip()
        lon_raw = str(data.get("longitude", "")).strip()
        manual_severity = data.get("severity", "").strip()

    # Validation
    valid_types = {"Pothole", "Road Crack", "Damaged Signal", "Damaged Sign", "Broken Streetlight", "Other"}
    if not issue_type:
        return jsonify({"error": "Issue type is required."}), 400
    if issue_type not in valid_types:
        issue_type = "Other"

    if not location:
        return jsonify({"error": "Location description or street address is required."}), 400

    # Parse coordinates
    latitude = None
    longitude = None
    if lat_raw:
        try:
            latitude = round(float(lat_raw), 6)
        except ValueError:
            latitude = None
    if lon_raw:
        try:
            longitude = round(float(lon_raw), 6)
        except ValueError:
            longitude = None

    # Handle image upload
    image_path = None
    saved_file_system_path = None
    if "image" in request.files:
        file = request.files["image"]
        if file and file.filename and allowed_file(file.filename):
            ext = file.filename.rsplit(".", 1)[1].lower()
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            safe_name = f"defect_{timestamp}_{secure_filename(file.filename)}"
            saved_file_system_path = os.path.join(UPLOAD_FOLDER, safe_name)
            file.save(saved_file_system_path)
            image_path = f"/static/uploads/{safe_name}"

    # Default SVG illustration if no image uploaded
    if not image_path:
        type_to_svg = {
            "Pothole": "/static/img/demo_pothole.svg",
            "Road Crack": "/static/img/demo_crack.svg",
            "Damaged Signal": "/static/img/demo_signal.svg",
            "Damaged Sign": "/static/img/demo_sign.svg",
            "Broken Streetlight": "/static/img/demo_light.svg",
            "Other": "/static/img/demo_pothole.svg"
        }
        image_path = type_to_svg.get(issue_type, "/static/img/demo_pothole.svg")

    # Run AI Defect Analysis
    ai_result = analyze_defect(
        image_path=saved_file_system_path,
        issue_type_hint=issue_type,
        description=description
    )

    # Use manual severity if explicitly designated and valid, otherwise take AI detected severity
    valid_severities = {"Critical", "High", "Medium", "Low"}
    if manual_severity in valid_severities:
        severity = manual_severity
    else:
        severity = ai_result.get("severity", "Medium")

    confidence = ai_result.get("confidence", 0.90)

    # Write to SQLite
    conn = database.get_db_connection()
    cursor = conn.cursor()
    new_issue_id = database.generate_next_issue_id(cursor)
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO issues (
            issue_id, issue_type, description, location, latitude, longitude,
            severity, status, image_path, ai_confidence, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Reported', ?, ?, 0, ?, ?)
    """, (
        new_issue_id,
        issue_type,
        description,
        location,
        latitude,
        longitude,
        severity,
        image_path,
        confidence,
        now_str,
        now_str
    ))
    conn.commit()

    # Fetch inserted record
    cursor.execute("SELECT * FROM issues WHERE issue_id = ?", (new_issue_id,))
    created_record = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Issue logged successfully with ID {new_issue_id}.",
        "issue_id": new_issue_id,
        "issue": created_record,
        "ai_analysis": ai_result
    }), 201


@app.route("/api/issues/<issue_id>", methods=["PUT"])
def api_update_issue(issue_id):
    """
    Allows inspectors and admins to update issue status and/or severity.
    Valid statuses: Reported, Verified, In Progress, Resolved
    Valid severities: Critical, High, Medium, Low
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    new_severity = data.get("severity")

    valid_statuses = {"Reported", "Verified", "In Progress", "Resolved"}
    valid_severities = {"Critical", "High", "Medium", "Low"}

    updates = []
    params = []

    if new_status:
        if new_status not in valid_statuses:
            return jsonify({"error": f"Invalid status '{new_status}'."}), 400
        updates.append("status = ?")
        params.append(new_status)

    if new_severity:
        if new_severity not in valid_severities:
            return jsonify({"error": f"Invalid severity '{new_severity}'."}), 400
        updates.append("severity = ?")
        params.append(new_severity)

    if not updates:
        return jsonify({"error": "No valid fields provided to update."}), 400

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    updates.append("updated_at = ?")
    params.append(now_str)

    params.append(issue_id)

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"UPDATE issues SET {', '.join(updates)} WHERE issue_id = ?", params)
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": f"Issue '{issue_id}' not found."}), 404

    conn.commit()
    cursor.execute("SELECT * FROM issues WHERE issue_id = ?", (issue_id,))
    updated_record = dict(cursor.fetchone())
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Issue {issue_id} updated successfully.",
        "issue": updated_record
    })


@app.route("/api/issues/<issue_id>", methods=["DELETE"])
def api_delete_issue(issue_id):
    """Removes an issue record from SQLite."""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM issues WHERE issue_id = ?", (issue_id,))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": f"Issue '{issue_id}' not found."}), 404
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Issue {issue_id} deleted."})


# ---------------------------------------------------------
# AUTHENTICATION & SESSION
# ---------------------------------------------------------

@app.route("/api/login", methods=["POST"])
def api_login():
    """
    Authenticates municipal inspector / admin using SQLite admin credentials.
    Demo default: admin@civiceye.gov / admin123
    """
    data = request.get_json(silent=True) or request.form or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required."}), 400

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM admins WHERE email = ?", (email,))
    admin = cursor.fetchone()
    conn.close()

    if not admin:
        return jsonify({"success": False, "error": "Invalid administrator credentials."}), 401

    hashed = database.hash_password(password)
    if admin["password_hash"] != hashed:
        return jsonify({"success": False, "error": "Invalid administrator credentials."}), 401

    # Set session
    session["user_id"] = admin["id"]
    session["user_email"] = admin["email"]
    session["user_name"] = admin["name"]
    session["user_role"] = admin["role"]

    return jsonify({
        "success": True,
        "message": f"Welcome back, {admin['name']}.",
        "user": {
            "email": admin["email"],
            "name": admin["name"],
            "role": admin["role"]
        }
    })


@app.route("/api/auth/status", methods=["GET"])
def api_auth_status():
    """Returns the current admin session state."""
    if "user_id" in session:
        return jsonify({
            "is_authenticated": True,
            "user": {
                "email": session.get("user_email"),
                "name": session.get("user_name"),
                "role": session.get("user_role")
            }
        })
    return jsonify({"is_authenticated": False})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    """Clears the session."""
    session.clear()
    return jsonify({"success": True, "message": "Signed out successfully."})


# ---------------------------------------------------------
# DEMO DATA MANAGEMENT
# ---------------------------------------------------------

@app.route("/api/reset-demo", methods=["POST"])
def api_reset_demo():
    """Restores realistic municipal demo records."""
    database.reset_to_demo_data()
    return jsonify({"success": True, "message": "Demo data restored successfully."})


@app.route("/api/clear-demo", methods=["POST"])
def api_clear_demo():
    """Clears all records for clean benchmark testing."""
    database.clear_all_issues()
    return jsonify({"success": True, "message": "All issues cleared."})


if __name__ == "__main__":
    # Runs standalone on port 5000 (or PORT env var)
    port = int(os.environ.get("PORT", 5000))
    print(f"CIVICEYE AI Flask server running on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
