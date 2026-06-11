from __future__ import annotations

import os
import json
from pathlib import Path
from app.config import ANTIGRAVITY_DIR

SETTINGS_FILE = ANTIGRAVITY_DIR / "settings.json"

def get_settings() -> dict:
    if not SETTINGS_FILE.exists():
        return {}
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

def update_settings(new_settings: dict) -> dict:
    try:
        current = get_settings()
        current.update(new_settings)
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_FILE.write_text(json.dumps(current, indent=2), encoding="utf-8")
        return {"success": True, "settings": current}
    except Exception as e:
        return {"success": False, "error": str(e)}
