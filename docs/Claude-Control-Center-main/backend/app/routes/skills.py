import os
import re
import shutil
from pathlib import Path
from flask import Blueprint, jsonify, request
import frontmatter

from app.config import CLAUDE_DIR

bp = Blueprint("skills", __name__, url_prefix="/api/skills")

_SKILLS_DIR = CLAUDE_DIR / "skills"


def _detect_origin(entry: Path) -> dict:
    if entry.is_symlink():
        target = os.readlink(entry)
        if ".agents/skills" in target:
            return {"originType": "agent-marketplace", "originLabel": "Agent Marketplace"}
    return {"originType": "local", "originLabel": "User Installed"}


def _read_skill(entry: Path) -> dict | None:
    skill_md = entry / "SKILL.md"
    name = entry.name
    description = ""
    body = ""
    if skill_md.exists():
        try:
            post = frontmatter.load(str(skill_md))
            name = post.metadata.get("name", entry.name)
            description = post.metadata.get("description", "")
            body = post.content
        except Exception:
            pass
    return {
        "id": entry.name,
        "name": name,
        "description": description,
        "body": body,
        **_detect_origin(entry),
    }


@bp.get("")
def list_skills():
    if not _SKILLS_DIR.is_dir():
        return jsonify([])
    results = []
    for entry in sorted(_SKILLS_DIR.iterdir()):
        if entry.is_file():
            continue
        if not entry.is_dir():
            continue
        skill = _read_skill(entry)
        if skill:
            results.append(skill)
    return jsonify(results)


@bp.post("")
def create_skill():
    body = request.get_json(silent=True) or {}
    raw_name = (body.get("name") or "").strip()
    if not raw_name:
        return jsonify({"error": "name required"}), 400

    slug = re.sub(r"[^\w\-]", "_", raw_name).lower()
    skill_dir = _SKILLS_DIR / slug
    if skill_dir.exists():
        return jsonify({"error": f"Skill '{slug}' already exists"}), 409

    skill_dir.mkdir(parents=True)
    post = frontmatter.Post(
        content=body.get("body", ""),
        **{k: v for k, v in {
            "name": raw_name,
            "description": body.get("description", ""),
        }.items() if v},
    )
    (skill_dir / "SKILL.md").write_text(frontmatter.dumps(post), encoding="utf-8")
    return jsonify({"id": slug, "created": True}), 201


@bp.delete("/<skill_id>")
def delete_skill(skill_id: str):
    skill_dir = _SKILLS_DIR / skill_id
    if not skill_dir.exists():
        return jsonify({"error": "Not found"}), 404
    if skill_dir.is_symlink():
        return jsonify({"error": "Cannot delete marketplace skill"}), 403
    shutil.rmtree(skill_dir)
    return jsonify({"deleted": True})
