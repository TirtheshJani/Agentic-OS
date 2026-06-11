from __future__ import annotations

"""Obsidian vault config and note operations."""

import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import orjson

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "obsidian_vaults.json"
_lock = threading.Lock()


def _load() -> dict:
    if not _DATA_FILE.exists():
        return {"vaults": []}
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return {"vaults": []}


def _save(data: dict) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _DATA_FILE)


def list_vaults() -> list[dict]:
    return _load().get("vaults", [])


def _get_vault(vault_id: str) -> dict | None:
    return next((v for v in list_vaults() if v.get("id") == vault_id), None)


def add_vault(name: str, path: str) -> dict:
    vault_path = Path(path).expanduser().resolve()
    if not vault_path.exists():
        raise ValueError(f"Path does not exist: {path}")

    # Validate: has .obsidian/ dir OR has .md files
    has_obsidian = (vault_path / ".obsidian").exists()
    has_md = any(vault_path.rglob("*.md"))
    if not has_obsidian and not has_md:
        raise ValueError(f"Path does not appear to be an Obsidian vault (no .obsidian/ or .md files): {path}")

    vault = {
        "id": str(uuid.uuid4()),
        "name": name,
        "path": str(vault_path),
        "enabled": True,
        "last_synced": None,
    }
    data = _load()
    data.setdefault("vaults", []).append(vault)
    _save(data)
    return vault


def remove_vault(vault_id: str) -> bool:
    data = _load()
    vaults = data.get("vaults", [])
    new_vaults = [v for v in vaults if v.get("id") != vault_id]
    if len(new_vaults) == len(vaults):
        return False
    data["vaults"] = new_vaults
    _save(data)
    return True


def update_vault(vault_id: str, **kwargs) -> dict:
    data = _load()
    vaults = data.get("vaults", [])
    vault = next((v for v in vaults if v.get("id") == vault_id), None)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")
    allowed = {"name", "enabled", "last_synced", "path"}
    for k, v in kwargs.items():
        if k in allowed:
            vault[k] = v
    _save(data)
    return vault


def _resolve_note_path(vault: dict, relative_path: str) -> Path:
    """Safely resolve a note path inside the vault, preventing path traversal."""
    vault_path = Path(vault["path"]).resolve()
    note_path = (vault_path / relative_path).resolve()
    if not str(note_path).startswith(str(vault_path)):
        raise ValueError("Path traversal detected")
    return note_path


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter tags from content."""
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    yaml_block = parts[1]
    tags: list[str] = []
    for line in yaml_block.splitlines():
        m = re.match(r"^tags:\s*\[(.+)\]", line)
        if m:
            tags = [t.strip().strip('"\'') for t in m.group(1).split(",")]
            break
        m = re.match(r"^tags:\s*$", line)
        if m:
            continue
        m = re.match(r"^\s*-\s+(.+)$", line)
        if m:
            tags.append(m.group(1).strip())
    return {"tags": tags}


def list_notes(vault_id: str, folder: str = "") -> list[dict]:
    vault = _get_vault(vault_id)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")
    vault_path = Path(vault["path"]).resolve()
    base = vault_path / folder if folder else vault_path

    results: list[dict] = []
    for md in base.rglob("*.md"):
        try:
            stat = md.stat()
            rel = str(md.relative_to(vault_path))
            content = md.read_text(encoding="utf-8", errors="ignore")
            fm = _parse_frontmatter(content)
            results.append({
                "path": rel,
                "name": md.stem,
                "size": stat.st_size,
                "modifiedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "tags": fm.get("tags", []),
                "folder": str(md.parent.relative_to(vault_path)),
            })
        except Exception:
            continue
    results.sort(key=lambda n: n["modifiedAt"], reverse=True)
    return results


def read_note(vault_id: str, relative_path: str) -> dict:
    vault = _get_vault(vault_id)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")
    note_path = _resolve_note_path(vault, relative_path)
    if not note_path.exists():
        raise FileNotFoundError(f"Note not found: {relative_path}")
    content = note_path.read_text(encoding="utf-8")
    return {
        "path": relative_path,
        "name": note_path.stem,
        "content": content,
        "frontmatter": _parse_frontmatter(content),
    }


def write_note(vault_id: str, relative_path: str, content: str) -> dict:
    vault = _get_vault(vault_id)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")
    note_path = _resolve_note_path(vault, relative_path)
    note_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = note_path.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, note_path)
    return {"path": relative_path, "written": True}


def search_notes(vault_id: str, query: str) -> list[dict]:
    vault = _get_vault(vault_id)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")
    vault_path = Path(vault["path"]).resolve()
    query_lower = query.lower()
    results: list[dict] = []
    for md in vault_path.rglob("*.md"):
        try:
            content = md.read_text(encoding="utf-8", errors="ignore")
            if query_lower in content.lower():
                # Find context snippet
                idx = content.lower().find(query_lower)
                snippet = content[max(0, idx - 80):idx + 200].strip()
                rel = str(md.relative_to(vault_path))
                results.append({
                    "path": rel,
                    "name": md.stem,
                    "snippet": snippet,
                })
                if len(results) >= 50:
                    break
        except Exception:
            continue
    return results
