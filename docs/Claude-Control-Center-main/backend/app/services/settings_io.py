import os
from pathlib import Path
import orjson
from app.config import CLAUDE_DIR

_SETTINGS_PATH = CLAUDE_DIR / "settings.json"


def read_global() -> dict:
    if not _SETTINGS_PATH.exists():
        return {}
    try:
        return orjson.loads(_SETTINGS_PATH.read_bytes())
    except Exception:
        return {}


def write_global(data: dict) -> None:
    _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _SETTINGS_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
    os.replace(tmp, _SETTINGS_PATH)


def read_project(project_root: Path) -> dict:
    for name in ("settings.json", "settings.local.json"):
        p = project_root / ".claude" / name
        if p.exists():
            try:
                return orjson.loads(p.read_bytes())
            except Exception:
                return {}
    return {}


def write_project(project_root: Path, data: dict) -> None:
    d = project_root / ".claude"
    d.mkdir(parents=True, exist_ok=True)
    p = d / "settings.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
    os.replace(tmp, p)
