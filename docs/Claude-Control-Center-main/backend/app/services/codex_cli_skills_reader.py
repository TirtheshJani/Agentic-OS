from __future__ import annotations

from pathlib import Path

import frontmatter
import yaml

from app.config import CODEX_DIR

_SKILLS_DIR = CODEX_DIR / "skills"
_SYSTEM_DIR = _SKILLS_DIR / ".system"


def _read_skill_dir(entry: Path) -> dict | None:
    skill_md = entry / "SKILL.md"
    if not skill_md.exists():
        return None

    try:
        post = frontmatter.load(str(skill_md))
    except Exception:
        return None

    meta = post.metadata or {}
    nested_meta = meta.get("metadata") or {}

    agent_yaml_path = entry / "agents" / "openai.yaml"
    has_agent = agent_yaml_path.exists()
    agent_display_name = None
    agent_short_description = None
    icon_small = None
    icon_large = None

    if has_agent:
        try:
            with open(agent_yaml_path) as f:
                agent_data = yaml.safe_load(f) or {}
            iface = agent_data.get("interface") or {}
            agent_display_name = iface.get("display_name")
            agent_short_description = iface.get("short_description")
            icon_small = iface.get("icon_small")
            icon_large = iface.get("icon_large")
        except Exception:
            pass

    scripts_dir = entry / "scripts"
    assets_dir = entry / "assets"

    return {
        "id": entry.name,
        "name": meta.get("name") or entry.name,
        "description": meta.get("description") or "",
        "short_description": nested_meta.get("short-description") or meta.get("short_description") or "",
        "has_agent": has_agent,
        "agent_display_name": agent_display_name,
        "agent_short_description": agent_short_description,
        "icon_small": icon_small,
        "icon_large": icon_large,
        "has_scripts": scripts_dir.exists() and any(scripts_dir.iterdir()),
        "has_assets": assets_dir.exists() and any(assets_dir.iterdir()),
    }


def list_skills() -> list[dict]:
    if not _SKILLS_DIR.exists():
        return []
    results = []
    for entry in sorted(_SKILLS_DIR.iterdir()):
        if entry.name.startswith(".") or not entry.is_dir():
            continue
        skill = _read_skill_dir(entry)
        if skill:
            results.append(skill)
    return results


def list_system_skills() -> list[dict]:
    if not _SYSTEM_DIR.exists():
        return []
    results = []
    for entry in sorted(_SYSTEM_DIR.iterdir()):
        if entry.name.startswith(".") or not entry.is_dir():
            continue
        skill = _read_skill_dir(entry)
        if skill:
            results.append(skill)
    return results


def get_skill(skill_id: str) -> dict | None:
    entry = _SKILLS_DIR / skill_id
    if not entry.exists() or not entry.is_dir():
        entry = _SYSTEM_DIR / skill_id
        if not entry.exists():
            return None

    skill = _read_skill_dir(entry)
    if not skill:
        return None

    skill_md = entry / "SKILL.md"
    try:
        post = frontmatter.load(str(skill_md))
        skill["body"] = post.content
    except Exception:
        skill["body"] = ""

    return skill


def get_skill_agent(skill_id: str) -> dict | None:
    for base in (_SKILLS_DIR, _SYSTEM_DIR):
        agent_yaml = base / skill_id / "agents" / "openai.yaml"
        if agent_yaml.exists():
            try:
                with open(agent_yaml) as f:
                    data = yaml.safe_load(f) or {}
                iface = data.get("interface") or {}
                iface.pop("icon_small", None)
                iface.pop("icon_large", None)
                data["interface"] = iface
                return data
            except Exception:
                return None
    return None
