from __future__ import annotations
import re
from pathlib import Path
from flask import Blueprint, jsonify
import orjson

from app.config import CLAUDE_DIR

bp = Blueprint("agent_view", __name__, url_prefix="/api/agent-view")

_AGENTS_DIR = CLAUDE_DIR / "agents"
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _parse_agent_md(path: Path) -> dict:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return {"name": path.stem, "description": "", "tools": []}

    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {"name": path.stem, "description": "", "tools": []}

    try:
        import yaml
        meta = yaml.safe_load(m.group(1)) or {}
    except Exception:
        meta = {}

    tools_raw = meta.get("tools", [])
    if isinstance(tools_raw, str):
        tools = [t.strip() for t in tools_raw.split(",") if t.strip()]
    elif isinstance(tools_raw, list):
        tools = tools_raw
    else:
        tools = []

    return {
        "name": meta.get("name", path.stem),
        "description": meta.get("description", ""),
        "tools": tools,
    }


def _get_active_agent_names() -> set[str]:
    active = set()
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.is_dir():
        return active

    jsonl_files = sorted(
        projects_dir.rglob("*.jsonl"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )[:20]

    for jf in jsonl_files:
        try:
            for line in jf.read_bytes().splitlines():
                if not line.strip():
                    continue
                try:
                    obj = orjson.loads(line)
                except Exception:
                    continue
                msg = obj.get("message", obj)
                content = msg.get("content", [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_use":
                            inp = block.get("input", {})
                            if isinstance(inp, dict):
                                desc = inp.get("description", "") or inp.get("subagent_type", "")
                                if desc:
                                    active.add(desc.lower().replace("-", "_"))
        except Exception:
            continue
    return active


@bp.get("/agents")
def list_agents():
    if not _AGENTS_DIR.is_dir():
        return jsonify([])

    active_names = _get_active_agent_names()
    results = []

    for md_file in sorted(_AGENTS_DIR.glob("*.md")):
        meta = _parse_agent_md(md_file)
        name_slug = meta["name"].lower().replace("-", "_").replace(" ", "_")
        is_active = name_slug in active_names or md_file.stem.lower().replace("-", "_") in active_names
        results.append({
            "name": meta["name"],
            "slug": md_file.stem,
            "description": meta["description"],
            "tools": meta["tools"],
            "filePath": str(md_file),
            "isActive": is_active,
        })

    return jsonify(results)


@bp.post("/agents/<name>/interrupt")
def interrupt_agent(name: str):
    return jsonify({
        "status": "unsupported",
        "message": "Agent interruption is not yet supported by Claude Code's public API. Use claude /interrupt in the terminal.",
    })
