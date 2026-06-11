import base64
from pathlib import Path
from flask import Blueprint, jsonify, request

from app.config import CLAUDE_DIR
from app.services.project_decoder import display_name

bp = Blueprint("claude_md", __name__, url_prefix="/api/claude-md")

# Directories to skip during recursive CLAUDE.md scan
_SKIP_DIRS = frozenset({
    "node_modules", ".git", "vendor", "dist", "build", ".venv", "venv",
    "__pycache__", ".next", ".nuxt", ".tox", "coverage", ".cache",
})

_SCAN_MAX_DEPTH = 5


def _encode_path(path: str) -> str:
    return base64.urlsafe_b64encode(path.encode()).decode().rstrip("=")


def _decode_path(encoded: str) -> str:
    padding = 4 - (len(encoded) % 4)
    if padding != 4:
        encoded += "=" * padding
    return base64.urlsafe_b64decode(encoded).decode()


def _known_paths() -> set[Path]:
    """Return the set of paths currently returned by _list_all_files()."""
    return {Path(f["path"]).resolve() for f in _list_all_files()}


def _safe_path(encoded: str) -> Path:
    """Decode and validate the path is a known CLAUDE.md file."""
    path = Path(_decode_path(encoded)).resolve()
    if path not in _known_paths():
        raise PermissionError("Path not in allowed list")
    return path


def _safe_raw_path(raw: str) -> Path:
    """Validate a plain string path stays within CLAUDE_DIR (for new file creation only)."""
    path = Path(raw).resolve()
    if not path.is_relative_to(CLAUDE_DIR.resolve()):
        raise PermissionError("Path outside allowed directory")
    return path


def _fuzzy_resolve_project_path(dirname: str) -> Path | None:
    """
    Resolve an encoded ~/.claude/projects/ dirname to a real filesystem path.

    The Claude Code CLI encoding is lossy: '/', ' ', '_', and '-' in path
    components all become '-' in the stored name, so pure string reversal
    fails.  This function walks the filesystem greedily, at each level trying
    to match one or more consecutive encoded segments as a real directory entry
    using '_', ' ', '-', or no separator.
    """
    if not dirname.startswith("-"):
        return None

    # Strip the leading '-' and split into segments
    segments = dirname[1:].split("-")
    # Remove empty strings that arise from consecutive dashes
    segments = [s for s in segments if s]

    def _walk(path: Path, idx: int) -> Path | None:
        if idx >= len(segments):
            return path
        # Try greedily consuming more segments at once (longer = more specific)
        for count in range(len(segments) - idx, 0, -1):
            chunk = segments[idx : idx + count]
            for sep in ("_", " ", "-", ""):
                candidate_name = sep.join(chunk)
                candidate = path / candidate_name
                if candidate.is_dir():
                    result = _walk(candidate, idx + count)
                    if result is not None:
                        return result
        return None

    return _walk(Path("/"), 0)


def _find_host_home_dirs() -> list[Path]:
    """
    Derive the host user's home directory by inspecting ~/.claude/projects/ entries.
    Returns resolved Path objects for directories that actually exist.
    """
    homes: list[Path] = []
    seen: set[Path] = set()
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.is_dir():
        return homes

    for entry in projects_dir.iterdir():
        name = entry.name
        if not name.startswith("-home-"):
            continue
        # -home-USERNAME-... → username is the second segment
        parts = name.split("-", 3)
        if len(parts) < 3:
            continue
        username = parts[2]
        if not username:
            continue
        home = Path(f"/home/{username}")
        if home.is_dir() and home not in seen:
            homes.append(home)
            seen.add(home)

    return homes


def _scan_dir_for_claude_mds(root: Path, max_depth: int = _SCAN_MAX_DEPTH) -> list[Path]:
    """Recursively find CLAUDE.md files under root, skipping noise directories."""
    found: list[Path] = []

    def _walk(path: Path, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            for entry in path.iterdir():
                # Skip directory symlinks (avoid infinite loops); allow file symlinks
                if entry.is_symlink() and entry.is_dir():
                    continue
                if entry.is_dir():
                    if entry.name in _SKIP_DIRS:
                        continue
                    _walk(entry, depth + 1)
                elif entry.name == "CLAUDE.md" and (entry.is_file() or entry.is_symlink()):
                    real = entry.resolve()
                    if real.exists():
                        found.append(real)
        except (PermissionError, OSError):
            pass

    _walk(root, 0)
    return found


def _list_all_files() -> list[dict]:
    files: list[dict] = []
    seen_paths: set[Path] = set()

    def _add(path: Path, scope: str, label: str, proj_name: str | None = None) -> None:
        resolved = path.resolve()
        if resolved in seen_paths:
            return
        seen_paths.add(resolved)
        entry: dict = {
            "id": _encode_path(str(path)),
            "scope": scope,
            "label": label,
            "path": str(path),
        }
        if proj_name:
            entry["projectName"] = proj_name
        files.append(entry)

    # 1. Global ~/.claude/CLAUDE.md
    global_path = CLAUDE_DIR / "CLAUDE.md"
    if global_path.exists():
        _add(global_path, "global", "~/.claude/CLAUDE.md")

    # 2. Per-project CLAUDE.md via fuzzy path resolution of ~/.claude/projects/ dirs
    projects_dir = CLAUDE_DIR / "projects"
    if projects_dir.is_dir():
        for entry in sorted(projects_dir.iterdir()):
            if not entry.is_dir():
                continue
            project_root = _fuzzy_resolve_project_path(entry.name)
            if project_root is None:
                continue
            proj_name = project_root.name
            for candidate in (
                project_root / "CLAUDE.md",
                project_root / ".claude" / "CLAUDE.md",
            ):
                if candidate.exists():
                    rel = candidate.relative_to(project_root)
                    _add(candidate, "project", f"{proj_name}/{rel}", proj_name)

    # 3. Direct filesystem scan: find any CLAUDE.md files the project-dir scan missed.
    #    We scan ~/Documents (and ~/Desktop if it exists) for the host user, since
    #    those paths are mounted read-only at the same absolute paths in Docker.
    for home in _find_host_home_dirs():
        for scan_root in (home / "Documents", home / "Desktop"):
            if scan_root.is_dir():
                for md_path in _scan_dir_for_claude_mds(scan_root):
                    if md_path in seen_paths:
                        continue
                    proj_name = md_path.parent.name
                    _add(md_path, "project", f"{proj_name}/{md_path.name}", proj_name)

    return files


@bp.get("")
def list_files():
    return jsonify(_list_all_files())


@bp.get("/<encoded_path>")
def get_file(encoded_path: str):
    try:
        path = _safe_path(encoded_path)
    except PermissionError:
        return jsonify({"error": "Forbidden"}), 403
    except Exception:
        return jsonify({"error": "Invalid path"}), 400
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        content = path.read_text(encoding="utf-8")
        return jsonify({"path": str(path), "content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.put("/<encoded_path>")
def update_file(encoded_path: str):
    try:
        path = _safe_path(encoded_path)
    except PermissionError:
        return jsonify({"error": "Forbidden"}), 403
    except Exception:
        return jsonify({"error": "Invalid path"}), 400
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    body = request.get_json(silent=True) or {}
    content = body.get("content", "")
    try:
        path.write_text(content, encoding="utf-8")
        return jsonify({"updated": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.post("")
def create_file():
    body = request.get_json(silent=True) or {}
    raw_path = (body.get("path") or "").strip()
    if not raw_path:
        return jsonify({"error": "path required"}), 400
    content = body.get("content", "")
    try:
        path = _safe_raw_path(raw_path)
    except PermissionError:
        return jsonify({"error": "Forbidden"}), 403
    if path.exists():
        return jsonify({"error": "File already exists"}), 409
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return jsonify({"id": _encode_path(str(path)), "created": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.delete("/<encoded_path>")
def delete_file(encoded_path: str):
    try:
        path = _safe_path(encoded_path)
    except PermissionError:
        return jsonify({"error": "Forbidden"}), 403
    except Exception:
        return jsonify({"error": "Invalid path"}), 400
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        path.unlink()
        return jsonify({"deleted": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
