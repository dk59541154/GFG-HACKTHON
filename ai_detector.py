"""
CIVICEYE AI - Defect Detection Module (ai_detector.py)

Architecture Note:
This module currently implements a rule-based demo detector / computer vision adapter.
It does NOT run a heavyweight neural network in this environment, but is architected
with an identical input/output signature so a real YOLOv8/PyTorch or OpenCV pipeline
can be swapped in seamlessly by replacing the `detect_defects()` method.
"""

import os
import random
from typing import Dict, Any, Optional

# Severity mapping criteria based on defect characteristics
SEVERITY_RULES = {
    "Pothole": {
        "critical_keywords": ["deep", "tire", "rim", "swerving", "highway", "bus", "large", "crater"],
        "high_keywords": ["center", "lane", "cavity", "expanding"],
        "default_severity": "High",
        "base_confidence": 0.92
    },
    "Road Crack": {
        "critical_keywords": ["fault", "bridge", "separation", "heave"],
        "high_keywords": ["alligator", "wide", "structural"],
        "default_severity": "Medium",
        "base_confidence": 0.88
    },
    "Damaged Signal": {
        "critical_keywords": ["intersection", "twisted", "dark", "flashing", "fallen", "highway"],
        "high_keywords": ["angled", "visor", "pedestrian"],
        "default_severity": "Critical",
        "base_confidence": 0.95
    },
    "Damaged Sign": {
        "critical_keywords": ["stop", "yield", "one way", "missing", "do not enter"],
        "high_keywords": ["bent", "obscured", "speed limit"],
        "default_severity": "High",
        "base_confidence": 0.90
    },
    "Broken Streetlight": {
        "critical_keywords": ["crosswalk", "junction", "exposed", "wires"],
        "high_keywords": ["dark", "flickering", "casing"],
        "default_severity": "Low",
        "base_confidence": 0.86
    },
    "Other": {
        "critical_keywords": ["sinkhole", "hazard", "collapse", "gas", "water main"],
        "high_keywords": ["debris", "curb", "sidewalk"],
        "default_severity": "Medium",
        "base_confidence": 0.82
    }
}


class CivicEyeDetector:
    """
    Demo/Rule-Based Defect Auditor.
    Prepares payloads compatible with municipal Computer Vision standards.
    """

    def __init__(self, model_version: str = "demo-heuristic-v1"):
        self.model_version = model_version
        self.is_production_model = False

    def analyze(self, image_path: Optional[str] = None,
                issue_type_hint: Optional[str] = None,
                description: Optional[str] = "") -> Dict[str, Any]:
        """
        Analyzes an uploaded image and context.

        Parameters:
            image_path: Relative or absolute path to the stored image
            issue_type_hint: Optional manual classification from user form
            description: Optional textual notes describing the defect

        Returns:
            Dict matching specification:
            {
                "issue_type": str,
                "severity": str,
                "confidence": float,
                "model_version": str,
                "detections": list,
                "details": str
            }
        """
        # Determine issue type
        issue_type = issue_type_hint if issue_type_hint in SEVERITY_RULES else "Pothole"
        
        # Check description context for keywords if provided
        desc_lower = (description or "").lower()
        rules = SEVERITY_RULES.get(issue_type, SEVERITY_RULES["Other"])
        
        # Rule-based severity determination
        severity = rules["default_severity"]
        if any(kw in desc_lower for kw in rules.get("critical_keywords", [])):
            severity = "Critical"
        elif any(kw in desc_lower for kw in rules.get("high_keywords", [])):
            severity = "High"

        # Generate realistic confidence variance (e.g. 0.88 - 0.97)
        # Consistent base confidence plus slight deterministic variance based on file size/path
        variance = 0.0
        if image_path and os.path.exists(image_path):
            try:
                file_size = os.path.getsize(image_path)
                variance = (file_size % 100) / 2000.0  # 0.00 to 0.05
            except Exception:
                variance = 0.02
        else:
            variance = random.uniform(0.01, 0.04)

        confidence = round(min(0.98, rules["base_confidence"] + variance), 2)

        # Bounding box simulation [ymin, xmin, ymax, xmax] relative normalized coordinates
        bounding_box = {
            "ymin": 0.22,
            "xmin": 0.18,
            "ymax": 0.78,
            "xmax": 0.82,
            "label": f"{issue_type} ({severity})",
            "score": confidence
        }

        details = (
            f"Automated visual assessment detected patterns indicative of {issue_type}. "
            f"Assigned {severity} priority based on urban safety thresholds. "
            f"[Rule-based demo auditor; ready for YOLOv8 weights integration]."
        )

        return {
            "issue_type": issue_type,
            "severity": severity,
            "confidence": confidence,
            "model_version": self.model_version,
            "detections": [bounding_box],
            "details": details
        }


# Global singleton instance
detector = CivicEyeDetector()


def analyze_defect(image_path: Optional[str] = None,
                   issue_type_hint: Optional[str] = None,
                   description: Optional[str] = "") -> Dict[str, Any]:
    """Convenience functional wrapper."""
    return detector.analyze(image_path, issue_type_hint, description)
