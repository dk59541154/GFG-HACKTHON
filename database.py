"""
Database management for CIVICEYE AI.
Handles SQLite connection, schema initialization, migrations, and demo data.
"""

import os
import sqlite3
from datetime import datetime, timedelta
import hashlib

DATABASE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "civic_eye.db")


def get_db_connection():
    """Returns a sqlite3 connection with Row factory for dict-like access and WAL mode for concurrency."""
    conn = sqlite3.connect(DATABASE_FILE, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def hash_password(password: str) -> str:
    """Hashes a password using SHA-256 for demo admin authentication."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def init_db(seed_demo: bool = True):
    """
    Initializes the SQLite database tables and seeds demo data if empty.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create issues table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id TEXT UNIQUE NOT NULL,
            issue_type TEXT NOT NULL,
            description TEXT,
            location TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Reported',
            image_path TEXT,
            ai_confidence REAL DEFAULT 0.0,
            is_demo INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    # Create admins table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'Inspector',
            created_at TEXT NOT NULL
        )
    """)

    # Create default demo admin if not exists
    cursor.execute("SELECT id FROM admins WHERE email = ?", ("admin@civiceye.gov",))
    if not cursor.fetchone():
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO admins (email, password_hash, name, role, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            "admin@civiceye.gov",
            hash_password("admin123"),
            "Chief Auditor Miller",
            "Super Admin",
            now
        ))

    conn.commit()

    # Check if issues table is empty
    cursor.execute("SELECT COUNT(*) as count FROM issues")
    count = cursor.fetchone()["count"]

    if count == 0 and seed_demo:
        seed_demo_data(cursor)
        conn.commit()

    conn.close()


def generate_next_issue_id(cursor) -> str:
    """Generates sequential ID like CE-001, CE-002."""
    cursor.execute("SELECT issue_id FROM issues ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    if not row:
        return "CE-001"
    
    last_id = row["issue_id"]
    try:
        num = int(last_id.replace("CE-", ""))
        return f"CE-{num + 1:03d}"
    except (ValueError, AttributeError):
        cursor.execute("SELECT COUNT(*) as cnt FROM issues")
        cnt = cursor.fetchone()["cnt"]
        return f"CE-{cnt + 1:03d}"


def seed_demo_data(cursor):
    """Inserts realistic municipal infrastructure issues."""
    now = datetime.utcnow()
    
    # 6 realistic civic defects around a metropolitan downtown / arterial road network
    # (Coordinates centered around an active metro grid e.g. 37.7749, -122.4194)
    demo_issues = [
        {
            "issue_id": "CE-001",
            "issue_type": "Pothole",
            "description": "Deep asphalt crater in the center lane causing wheel damage and vehicle swerving.",
            "location": "4th Street & Market Blvd, Downtown",
            "latitude": 37.7858,
            "longitude": -122.4065,
            "severity": "Critical",
            "status": "In Progress",
            "image_path": "/static/img/demo_pothole.svg",
            "ai_confidence": 0.94,
            "days_ago": 1,
            "hours_ago": 3
        },
        {
            "issue_id": "CE-002",
            "issue_type": "Road Crack",
            "description": "Extensive alligator cracking expanding along the outer bike lane and curb.",
            "location": "820 Civic Center Way, North Quarter",
            "latitude": 37.7794,
            "longitude": -122.4186,
            "severity": "Medium",
            "status": "Verified",
            "image_path": "/static/img/demo_crack.svg",
            "ai_confidence": 0.88,
            "days_ago": 3,
            "hours_ago": 6
        },
        {
            "issue_id": "CE-003",
            "issue_type": "Damaged Signal",
            "description": "Eastbound traffic light head twisted 45 degrees following high wind gusts.",
            "location": "Grand Ave & 12th Street Intersection",
            "latitude": 37.7712,
            "longitude": -122.4231,
            "severity": "Critical",
            "status": "Reported",
            "image_path": "/static/img/demo_signal.svg",
            "ai_confidence": 0.96,
            "days_ago": 0,
            "hours_ago": 2
        },
        {
            "issue_id": "CE-004",
            "issue_type": "Damaged Sign",
            "description": "Stop sign bent at 30 degree angle, partially obscured by low tree branches.",
            "location": "Lincoln Park Drive & 7th Ave",
            "latitude": 37.7651,
            "longitude": -122.4342,
            "severity": "High",
            "status": "Verified",
            "image_path": "/static/img/demo_sign.svg",
            "ai_confidence": 0.91,
            "days_ago": 4,
            "hours_ago": 1
        },
        {
            "issue_id": "CE-005",
            "issue_type": "Broken Streetlight",
            "description": "Pedestrian crossing luminaire flickering erratically, casing visibly cracked.",
            "location": "Harbor Blvd near Pier 14 Promenade",
            "latitude": 37.7915,
            "longitude": -122.3928,
            "severity": "Low",
            "status": "Resolved",
            "image_path": "/static/img/demo_light.svg",
            "ai_confidence": 0.85,
            "days_ago": 5,
            "hours_ago": 8
        },
        {
            "issue_id": "CE-006",
            "issue_type": "Pothole",
            "description": "Subside trench along storm drain grate, asphalt crumbling under bus traffic.",
            "location": "Mission Expressway & South Terminal Rd",
            "latitude": 37.7580,
            "longitude": -122.4120,
            "severity": "High",
            "status": "Reported",
            "image_path": "/static/img/demo_pothole.svg",
            "ai_confidence": 0.92,
            "days_ago": 2,
            "hours_ago": 5
        },
        {
            "issue_id": "CE-007",
            "issue_type": "Road Crack",
            "description": "Longitudinal expansion joint separation along bridge approach ramp.",
            "location": "Overpass Ramp 3B, Bay Highway",
            "latitude": 37.7810,
            "longitude": -122.3980,
            "severity": "Medium",
            "status": "Resolved",
            "image_path": "/static/img/demo_crack.svg",
            "ai_confidence": 0.89,
            "days_ago": 6,
            "hours_ago": 4
        }
    ]

    for item in demo_issues:
        created_time = (now - timedelta(days=item["days_ago"], hours=item["hours_ago"])).strftime("%Y-%m-%d %H:%M:%S")
        updated_time = created_time
        cursor.execute("""
            INSERT INTO issues (
                issue_id, issue_type, description, location, latitude, longitude,
                severity, status, image_path, ai_confidence, is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """, (
            item["issue_id"],
            item["issue_type"],
            item["description"],
            item["location"],
            item["latitude"],
            item["longitude"],
            item["severity"],
            item["status"],
            item["image_path"],
            item["ai_confidence"],
            created_time,
            updated_time
        ))


def reset_to_demo_data():
    """Clears all issues and reinstates standard demo records."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM issues")
    seed_demo_data(cursor)
    conn.commit()
    conn.close()


def clear_all_issues():
    """Removes all issue records."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM issues")
    conn.commit()
    conn.close()
