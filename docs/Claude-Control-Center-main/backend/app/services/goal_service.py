"""
Goal service — detects /goal slash commands in session JSONL files and
manages user-defined milestones stored in backend/data/goals_data.json.

/goal commands are logged as ordinary `user` messages whose `message.content`
is a string holding the slash-command markup:
  {"type": "user", "message": {"role": "user", "content":
    "<command-name>/goal</command-name>\\n<command-message>goal</command-message>\\n<command-args>...</command-args>"}}
(Older / alternate logs may use {"type": "system", "subtype": "local_command",
"content": "..."}; both shapes are handled below.)
"""
from __future__ import annotations

import os
import re
import uuid as _uuid
from pathlib import Path
from datetime import datetime, timezone

import orjson

from app.config import CLAUDE_DIR, CODEX_DIR

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "goals_data.json"

_RE_CMD_NAME = re.compile(r"<command-name>(.*?)</command-name>", re.DOTALL)
_RE_CMD_ARGS = re.compile(r"<command-args>(.*?)</command-args>", re.DOTALL)


# ---------------------------------------------------------------------------
# Milestone store (persistent)
# ---------------------------------------------------------------------------

def _load_store() -> dict:
    try:
        return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return {}


def _save_store(data: dict) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
    os.replace(tmp, _DATA_FILE)


def _store_key(project_id: str, session_id: str, goal_id: str) -> str:
    return f"{project_id}/{session_id}/{goal_id}"


# ---------------------------------------------------------------------------
# JSONL scanning
# ---------------------------------------------------------------------------

def _iter_raw(path: Path):
    try:
        with open(path, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield orjson.loads(line)
                except Exception:
                    continue
    except OSError:
        return


def _command_text(msg: dict) -> str | None:
    """
    Return the slash-command markup string carried by a raw JSONL message, or
    None if this message is not a slash-command invocation.

    Two log shapes exist:
      * type=="user" with message.content being the command-markup string
        (current Claude Code / Codex format)
      * type=="system", subtype=="local_command" with a top-level `content`
        string (older format)

    We only accept string content that *begins* with `<command-name>` so we
    never pick up assistant prose or tool-result payloads that merely quote the
    markup somewhere in their body.
    """
    mtype = msg.get("type")

    if mtype == "system" and msg.get("subtype") == "local_command":
        content = msg.get("content")
    elif mtype == "user":
        message = msg.get("message")
        content = message.get("content") if isinstance(message, dict) else None
    else:
        return None

    if not isinstance(content, str):
        return None
    if not content.lstrip().startswith("<command-name>"):
        return None
    return content


def _parse_goal_command(content: str) -> tuple[str, str] | None:
    """Return (command_name, args) or None if not a /goal family command."""
    name_m = _RE_CMD_NAME.search(content)
    if not name_m:
        return None
    cmd = name_m.group(1).strip()
    if not cmd.startswith("/goal"):
        return None
    args_m = _RE_CMD_ARGS.search(content)
    args = args_m.group(1).strip() if args_m else ""
    return cmd, args


def scan_session_for_goals(jsonl_path: Path) -> list[dict]:
    """
    Scan a single JSONL file and return a list of goal dicts detected from
    /goal slash commands.
    """
    goals: list[dict] = []
    current_goal: dict | None = None

    for msg in _iter_raw(jsonl_path):
        content = _command_text(msg)
        if content is None:
            continue
        parsed = _parse_goal_command(content)
        if not parsed:
            continue
        cmd, args = parsed
        ts = msg.get("timestamp", datetime.now(timezone.utc).isoformat())

        arg_key = args.lower()

        # Control subcommands act on the current goal rather than creating one.
        if arg_key in ("pause", "paused"):
            if current_goal:
                current_goal["status"] = "paused"
                current_goal["updatedAt"] = ts
        elif arg_key in ("resume", "resumed"):
            if current_goal:
                current_goal["status"] = "active"
                current_goal["updatedAt"] = ts
        elif arg_key in ("clear", "cleared", "cancel", "cancelled", "stop"):
            if current_goal:
                current_goal["status"] = "cleared"
                current_goal["updatedAt"] = ts
        elif arg_key in ("done", "complete", "completed", "finish", "finished"):
            if current_goal:
                current_goal["status"] = "completed"
                current_goal["updatedAt"] = ts
        elif args:
            # `/goal <text>` — a new objective. Supersede any still-active goal.
            if current_goal and current_goal["status"] == "active":
                current_goal["status"] = "cleared"
            current_goal = {
                "id": str(_uuid.uuid4()),
                "text": args,
                "status": "active",
                "createdAt": ts,
                "updatedAt": ts,
            }
            goals.append(current_goal)
        # bare `/goal` with no args — ignore (status query, not a new goal)

    return goals


# ---------------------------------------------------------------------------
# Dashboard — all sessions with goals
# ---------------------------------------------------------------------------

def _iter_claude_jsonl_files():
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.is_dir():
        return
    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        for jsonl_file in project_dir.glob("*.jsonl"):
            yield project_dir.name, jsonl_file.stem, jsonl_file


def _iter_codex_jsonl_files():
    sessions_dir = CODEX_DIR / "sessions"
    if not sessions_dir.is_dir():
        return
    for jsonl_file in sessions_dir.glob("*.jsonl"):
        yield "__codex__", jsonl_file.stem, jsonl_file


def get_all_sessions_with_goals() -> list[dict]:
    store = _load_store()
    results = []

    for project_id, session_id, path in list(_iter_claude_jsonl_files()) + list(_iter_codex_jsonl_files()):
        goals = scan_session_for_goals(path)
        if not goals:
            continue

        # Merge milestones from store
        for goal in goals:
            key = _store_key(project_id, session_id, goal["id"])
            milestones = store.get(key, [])
            goal["milestones"] = milestones
            total = len(milestones)
            done = sum(1 for m in milestones if m.get("completed"))
            goal["progress"] = round(done / total * 100) if total else 0

        # Session metadata from first few renderable messages
        cwd = None
        slug = None
        last_at = None
        for msg in _iter_raw(path):
            if msg.get("type") in {"user", "assistant"}:
                if not cwd:
                    cwd = msg.get("cwd")
                    slug = msg.get("slug")
                ts = msg.get("timestamp")
                if ts and (last_at is None or ts > last_at):
                    last_at = ts

        results.append({
            "projectId": project_id,
            "sessionId": session_id,
            "sessionSlug": slug,
            "cwd": cwd,
            "lastMessageAt": last_at,
            "goals": goals,
        })

    results.sort(key=lambda r: r.get("lastMessageAt") or "", reverse=True)
    return results


def get_session_goals(project_id: str, session_id: str) -> list[dict]:
    """Return goals with milestones for a specific session."""
    if project_id == "__codex__":
        path = CODEX_DIR / "sessions" / f"{session_id}.jsonl"
    else:
        path = CLAUDE_DIR / "projects" / project_id / f"{session_id}.jsonl"

    goals = scan_session_for_goals(path)
    if not goals:
        return []

    store = _load_store()
    for goal in goals:
        key = _store_key(project_id, session_id, goal["id"])
        milestones = store.get(key, [])
        goal["milestones"] = milestones
        total = len(milestones)
        done = sum(1 for m in milestones if m.get("completed"))
        goal["progress"] = round(done / total * 100) if total else 0

    return goals


# ---------------------------------------------------------------------------
# Milestone CRUD
# ---------------------------------------------------------------------------

def add_milestone(project_id: str, session_id: str, goal_id: str, text: str) -> dict:
    store = _load_store()
    key = _store_key(project_id, session_id, goal_id)
    milestone = {
        "id": str(_uuid.uuid4()),
        "text": text,
        "completed": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    store.setdefault(key, []).append(milestone)
    _save_store(store)
    return milestone


def toggle_milestone(project_id: str, session_id: str, goal_id: str, milestone_id: str) -> dict | None:
    store = _load_store()
    key = _store_key(project_id, session_id, goal_id)
    for m in store.get(key, []):
        if m["id"] == milestone_id:
            m["completed"] = not m["completed"]
            _save_store(store)
            return m
    return None


def delete_milestone(project_id: str, session_id: str, goal_id: str, milestone_id: str) -> bool:
    store = _load_store()
    key = _store_key(project_id, session_id, goal_id)
    before = store.get(key, [])
    after = [m for m in before if m["id"] != milestone_id]
    if len(after) == len(before):
        return False
    store[key] = after
    _save_store(store)
    return True
