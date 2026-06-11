from pathlib import Path
from flask import Blueprint, jsonify

import frontmatter

from app.config import CLAUDE_DIR
from app.core import scanner_registry
from app.services.settings_io import read_global

bp = Blueprint("health", __name__, url_prefix="/api/health")


def _scan_references() -> list[dict]:
    issues = []

    # 1. Skills missing SKILL.md
    skills_dir = CLAUDE_DIR / "skills"
    if skills_dir.is_dir():
        for entry in skills_dir.iterdir():
            if entry.is_dir() and not (entry / "SKILL.md").exists():
                issues.append({
                    "type": "skill",
                    "resource": entry.name,
                    "brokenRef": "SKILL.md",
                    "hint": f"Skill directory '{entry.name}' has no SKILL.md descriptor",
                })

    # 2. Commands with malformed frontmatter
    commands_dir = CLAUDE_DIR / "commands"
    if commands_dir.is_dir():
        for cmd_file in commands_dir.glob("*.md"):
            try:
                frontmatter.load(str(cmd_file))
            except Exception as e:
                issues.append({
                    "type": "command",
                    "resource": cmd_file.name,
                    "brokenRef": "frontmatter",
                    "hint": f"Command '{cmd_file.stem}' has invalid frontmatter: {e}",
                })

    # 3. Agent library entries whose installed skill/subagent files are missing
    agent_lib_dir = Path(__file__).parent.parent.parent / "data" / "agent_library"
    if agent_lib_dir.is_dir():
        import orjson
        for agent_file in agent_lib_dir.glob("*.json"):
            try:
                agent = orjson.loads(agent_file.read_bytes())
            except Exception:
                continue
            slug = agent.get("slug", "")
            if not slug:
                continue
            if agent.get("installed_skill") is True:
                skill_path = CLAUDE_DIR / "skills" / slug / "SKILL.md"
                if not skill_path.exists():
                    issues.append({
                        "type": "agent_library",
                        "resource": agent.get("name", slug),
                        "brokenRef": f"skills/{slug}/SKILL.md",
                        "hint": f"Agent '{agent.get('name', slug)}' is marked as skill-installed but skill file is missing",
                    })
            if agent.get("installed_subagent") is True:
                subagent_path = CLAUDE_DIR / "agents" / f"{slug}.md"
                if not subagent_path.exists():
                    issues.append({
                        "type": "agent_library",
                        "resource": agent.get("name", slug),
                        "brokenRef": f"agents/{slug}.md",
                        "hint": f"Agent '{agent.get('name', slug)}' is marked as subagent-installed but agent file is missing",
                    })

    # 4. Hooks with empty commands
    settings = read_global()
    for event, entries in settings.get("hooks", {}).items():
        for idx, entry in enumerate(entries):
            for hook in entry.get("hooks", []):
                if not hook.get("command", "").strip():
                    issues.append({
                        "type": "hook",
                        "resource": f"{event}[{idx}]",
                        "brokenRef": "command",
                        "hint": f"Hook in {event} at index {idx} has an empty command",
                    })

    return issues


@bp.get("/references")
def get_references():
    issues = _scan_references()
    return jsonify({"issues": issues, "count": len(issues)})


@bp.get("/scanners")
def get_scanners():
    """Lifecycle status for every background scanner.

    Each entry reports ``enabled``, ``last_run``, ``last_error`` and an
    estimated ``next_run`` so operators can confirm the daemon threads are
    alive (or see why one was disabled / failed to start).
    """
    scanners = scanner_registry.snapshot()
    return jsonify({
        "scanners": scanners,
        "count": len(scanners),
        "enabled_count": sum(1 for s in scanners if s.get("enabled")),
    })
