"""
Eval orchestrator service (facade).

Grades Claude Code and Codex CLI sessions on a composite 0-100 score
(A–F letter grade) across three weighted dimensions:

  Token Efficiency   30% — output value vs tokens consumed
  Code Quality       40% — git diff + static analysis + LLM judge
  Coherence          30% — correction rate, tool efficiency, session focus

Results are cached in backend/data/eval_results.json. A background daemon
auto-grades ungraded sessions on startup and periodically re-checks.

Pure scoring lives in ``eval_scoring``; stats rollup in ``eval_aggregation``.
:class:`EvalService` owns persistence + orchestration with constructor-injected
``data_file`` and ``clock``; module-level functions delegate to a default
instance to preserve the historical ``eval_service.xxx()`` API.
"""
from __future__ import annotations

import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import orjson

from app.core import scanner_registry
from app.services import analytics_service
from app.services import eval_aggregation, eval_scoring
from app.services import eval_static_service, eval_judge_service

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "eval_results.json"

# How often the background thread wakes to check for new ungraded sessions (seconds).
_SCAN_INTERVAL = 300  # 5 minutes

Clock = Callable[[], datetime]


def _extract_user_messages(jsonl_path: Path) -> list[str]:
    """Return plaintext of user messages from a JSONL file."""
    texts = []
    try:
        with open(jsonl_path, "rb") as f:
            for raw in f:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    msg = orjson.loads(raw)
                except Exception:
                    continue
                if msg.get("type") != "user":
                    continue
                content = msg.get("content") or (msg.get("message") or {}).get("content")
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            texts.append(block.get("text", ""))
    except Exception:
        pass
    return texts


class EvalService:
    """Grade sessions and persist results, with injectable fs + clock."""

    def __init__(
        self,
        *,
        data_file: Path | str | None = None,
        clock: Clock | None = None,
        scan_interval: int = _SCAN_INTERVAL,
    ) -> None:
        self._data_file = Path(data_file) if data_file is not None else _DATA_FILE
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._scan_interval = scan_interval
        self._lock = threading.RLock()

    # --- persistence -------------------------------------------------------

    def load_results(self) -> dict[str, dict]:
        if not self._data_file.exists():
            return {}
        try:
            with self._lock:
                return orjson.loads(self._data_file.read_bytes())
        except Exception:
            return {}

    def save_results(self, results: dict[str, dict]) -> None:
        self._data_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._data_file.with_suffix(".tmp")
        with self._lock:
            tmp.write_bytes(orjson.dumps(results, option=orjson.OPT_INDENT_2))
            tmp.replace(self._data_file)

    def save_result(self, result: dict) -> None:
        results = self.load_results()
        results[result["session_id"]] = result
        self.save_results(results)

    def get_result(self, session_id: str) -> dict | None:
        return self.load_results().get(session_id)

    def update_repo_override(self, session_id: str, repo_path: str) -> bool:
        results = self.load_results()
        if session_id not in results:
            return False
        results[session_id]["repo_override"] = repo_path
        results[session_id]["status"] = "pending"
        self.save_results(results)
        return True

    # --- session extraction ------------------------------------------------

    def _find_jsonl(self, summary: dict) -> Path | None:
        """Locate the JSONL file for a Claude Code session summary."""
        from app.config import CLAUDE_DIR
        project_dir = Path(CLAUDE_DIR) / "projects" / summary.get("project_dir", "")
        sid = summary.get("session_id", "")
        if not sid:
            return None
        candidate = project_dir / f"{sid}.jsonl"
        return candidate if candidate.exists() else None

    # --- grading -----------------------------------------------------------

    def grade_session(self, summary: dict, tool: str = "claude", repo_override: str | None = None) -> dict:
        """Grade one session and return the full eval result dict."""
        session_id = summary.get("session_id", "unknown")
        cwd = repo_override or summary.get("cwd") or summary.get("project_path") or ""

        # --- Git + static analysis ---
        repo = eval_static_service.detect_repo(cwd) if cwd else None
        first_ts = summary.get("first_ts") or ""
        last_ts = summary.get("last_ts") or ""

        commits: list[dict] = []
        git_stats: dict = {}
        if repo and first_ts:
            commits = eval_static_service.get_session_commits(repo, first_ts, last_ts or first_ts)
            git_stats = eval_static_service.get_diff_stats(repo, commits)

        static_info: dict = {}
        if cwd:
            static_info = eval_static_service.run_static_analysis(cwd)

        git_info = {
            "repo": repo,
            "commits": commits[:20],  # cap stored commits at 20
            "commit_count": git_stats.get("commit_count", 0),
            "files_changed": git_stats.get("files_changed", 0),
            "insertions": git_stats.get("insertions", 0),
            "deletions": git_stats.get("deletions", 0),
        }

        # --- Build diff text for LLM judge ---
        diff_text = ""
        if repo and commits:
            first = commits[-1]["hash"]
            last = commits[0]["hash"]
            try:
                r = subprocess.run(
                    ["git", "diff", f"{first}^", last, "--unified=3"],
                    cwd=repo, capture_output=True, text=True, timeout=30,
                )
                diff_text = r.stdout[:8000]
            except Exception:
                pass

        # Augment summary with first/last user message text for judge
        if tool == "claude":
            jsonl_path = self._find_jsonl(summary)
            if jsonl_path:
                msgs = _extract_user_messages(jsonl_path)
                summary = {**summary, "first_user_msg": msgs[0][:400] if msgs else "", "last_user_msg": msgs[-1][:400] if msgs else ""}
        else:
            # Codex CLI: task_text serves as first user message
            summary = {**summary, "first_user_msg": summary.get("task_text", "")[:400], "last_user_msg": ""}

        # --- LLM judge ---
        judge = eval_judge_service.judge_session(summary, diff_text)

        # --- Dimension scores ---
        token_eff_score, token_eff_details = eval_scoring.score_token_efficiency(summary)
        coherence_score, coherence_details = eval_scoring.score_coherence(summary)
        git_code_score, git_code_details = eval_scoring.score_code_quality_from_git(git_info, static_info)
        code_quality_score, blend_details = eval_scoring.blend_code_quality(git_code_score, judge)

        # --- Composite score ---
        composite = (
            token_eff_score * 0.30
            + code_quality_score * 0.40
            + coherence_score * 0.30
        )
        composite = round(composite, 1)
        grade = eval_scoring.letter_grade(composite)

        return {
            "session_id": session_id,
            "tool": tool,
            "project": summary.get("project", ""),
            "cwd": cwd,
            "first_ts": first_ts,
            "last_ts": last_ts,
            "task_category": summary.get("task_category", "general"),
            "graded_at": self._clock().isoformat(),
            "composite_score": composite,
            "grade": grade,
            "token_efficiency": {"score": token_eff_score, "details": token_eff_details},
            "code_quality": {"score": code_quality_score, "details": {**git_code_details, **blend_details}},
            "coherence": {"score": coherence_score, "details": coherence_details},
            "judge": judge,
            "git": git_info,
            "static": static_info,
            "repo_override": repo_override,
            "status": "done",
        }

    def grade_one(self, session_id: str, tool: str | None = None) -> dict | None:
        """Grade a single session by ID. Returns the result or None if not found."""
        # Try Claude Code first
        for s in analytics_service.load():
            if s.get("session_id") == session_id:
                override = (self.get_result(session_id) or {}).get("repo_override")
                result = self.grade_session(s, tool="claude", repo_override=override)
                self.save_result(result)
                return result

        # Try Codex CLI
        from app.services import codex_cli_session_scanner
        for s in codex_cli_session_scanner.load():
            if s.get("session_id") == session_id:
                override = (self.get_result(session_id) or {}).get("repo_override")
                result = self.grade_session(s, tool="codex", repo_override=override)
                self.save_result(result)
                return result

        return None

    def scan_ungraded(self, limit: int = 50) -> int:
        """Grade all sessions not yet in eval_results.json. Returns count graded."""
        results = self.load_results()
        graded = 0

        # Claude Code sessions
        for s in analytics_service.load():
            sid = s.get("session_id")
            if not sid or sid in results:
                continue
            try:
                results[sid] = self.grade_session(s, tool="claude")
                graded += 1
                if graded >= limit:
                    break
            except Exception:
                continue

        # Codex CLI sessions
        if graded < limit:
            from app.services import codex_cli_session_scanner
            for s in codex_cli_session_scanner.load():
                sid = s.get("session_id")
                if not sid or sid in results:
                    continue
                try:
                    results[sid] = self.grade_session(s, tool="codex")
                    graded += 1
                    if graded >= limit:
                        break
                except Exception:
                    continue

        if graded > 0:
            self.save_results(results)
        return graded

    # --- aggregation -------------------------------------------------------

    def build_stats(self, days: int | None = 30) -> dict:
        results = list(self.load_results().values())
        return eval_aggregation.build_stats(results, days, now=self._clock())

    # --- lifecycle ---------------------------------------------------------

    def scan_all_background(self) -> None:
        t = threading.Thread(target=self._background_loop, name="eval-scanner", daemon=True)
        t.start()

    def _background_loop(self) -> None:
        # Initial delay to let other services start first
        time.sleep(30)
        while True:
            try:
                self.scan_ungraded(limit=20)
                scanner_registry.heartbeat("eval", interval=self._scan_interval)
            except Exception:
                pass
            time.sleep(self._scan_interval)


# ---------------------------------------------------------------------------
# Default instance + module-level shims (back-compat surface)
# ---------------------------------------------------------------------------

_default: EvalService | None = None
_default_lock = threading.Lock()


def get_eval_service() -> EvalService:
    """Return the process-wide default EvalService (lazily created)."""
    global _default
    if _default is None:
        with _default_lock:
            if _default is None:
                _default = EvalService()
    return _default


def grade_session(summary: dict, tool: str = "claude", repo_override: str | None = None) -> dict:
    return get_eval_service().grade_session(summary, tool=tool, repo_override=repo_override)


def grade_one(session_id: str, tool: str | None = None) -> dict | None:
    return get_eval_service().grade_one(session_id, tool=tool)


def scan_ungraded(limit: int = 50) -> int:
    return get_eval_service().scan_ungraded(limit=limit)


def build_stats(days: int | None = 30) -> dict:
    return get_eval_service().build_stats(days=days)


def load_results() -> dict[str, dict]:
    return get_eval_service().load_results()


def get_result(session_id: str) -> dict | None:
    return get_eval_service().get_result(session_id)


def save_result(result: dict) -> None:
    get_eval_service().save_result(result)


def update_repo_override(session_id: str, repo_path: str) -> bool:
    return get_eval_service().update_repo_override(session_id, repo_path)


def _save_results(results: dict[str, dict]) -> None:
    """Back-compat: the eval route writes results directly via this name."""
    get_eval_service().save_results(results)


def _load_results() -> dict[str, dict]:
    return get_eval_service().load_results()


def scan_all_background() -> None:
    get_eval_service().scan_all_background()
