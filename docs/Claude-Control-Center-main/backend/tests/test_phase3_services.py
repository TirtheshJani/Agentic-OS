"""Phase 3 — services testable in isolation + scanner health/lifecycle.

These exercise the constructor-injected service classes against a temp tree
(no host filesystem, no network) and the new scanner registry + health endpoint.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.core import scanner_registry
from app.services.analytics_service import AnalyticsService
from app.services.eval_service import EvalService
from app.services.memory_rag_service import MemoryRagService


# ---------------------------------------------------------------------------
# AnalyticsService — DI + ingest/aggregation split
# ---------------------------------------------------------------------------

def _session_row(ts: str, **usage) -> dict:
    return {
        "type": "assistant",
        "timestamp": ts,
        "message": {"model": "claude-sonnet-4-6", "usage": usage},
        "content": [{"type": "tool_use", "name": "Bash", "input": {"command": "pytest"}}],
    }


def test_analytics_service_scans_tmp_tree(tmp_path, write_jsonl):
    claude = tmp_path / "claude"
    proj = claude / "projects" / "-home-me-app"
    write_jsonl(proj / "sess1.jsonl", [
        {"type": "user", "timestamp": "2026-05-30T10:00:00Z", "content": "hi"},
        _session_row("2026-05-30T10:01:00Z", input_tokens=100, output_tokens=50, cache_read_input_tokens=10),
    ])

    svc = AnalyticsService(
        claude_dir=claude,
        data_file=tmp_path / "out" / "analytics.json",
        clock=lambda: datetime(2026, 5, 30, tzinfo=timezone.utc),
    )
    summaries = svc.scan_all()
    assert len(summaries) == 1
    s = summaries[0]
    assert s["input_tokens"] == 100
    assert s["has_verification"] is True  # ran pytest

    # Cached + reloadable in isolation
    assert svc.load() == summaries

    stats = svc.build_stats(summaries, days=30)
    assert stats["overview"]["total_sessions"] == 1
    assert stats["tokens"]["input_tokens"] == 100


def test_analytics_clock_drives_day_window(tmp_path, write_jsonl):
    claude = tmp_path / "claude"
    proj = claude / "projects" / "-p"
    write_jsonl(proj / "old.jsonl", [
        _session_row("2026-01-01T00:00:00Z", input_tokens=10, output_tokens=5),
    ])
    svc = AnalyticsService(
        claude_dir=claude,
        data_file=tmp_path / "a.json",
        clock=lambda: datetime(2026, 5, 30, tzinfo=timezone.utc),
    )
    summaries = svc.scan_all()
    # 7-day window in late May excludes the January session.
    assert svc.build_stats(summaries, days=7)["overview"]["total_sessions"] == 0
    # No window keeps it.
    assert svc.build_stats(summaries, days=None)["overview"]["total_sessions"] == 1


# ---------------------------------------------------------------------------
# EvalService — DI persistence + pure scoring/aggregation split
# ---------------------------------------------------------------------------

def test_eval_service_persists_in_isolation(tmp_path):
    svc = EvalService(
        data_file=tmp_path / "eval.json",
        clock=lambda: datetime(2026, 5, 30, tzinfo=timezone.utc),
    )
    assert svc.load_results() == {}
    svc.save_result({"session_id": "abc", "status": "done", "composite_score": 88.0,
                     "grade": "B", "graded_at": "2026-05-30T00:00:00+00:00"})
    assert svc.get_result("abc")["composite_score"] == 88.0

    stats = svc.build_stats(days=None)
    assert stats["total"] == 1
    assert stats["graded"] == 1
    assert stats["grade_distribution"]["B"] == 1


def test_eval_scoring_is_pure():
    from app.services import eval_scoring
    assert eval_scoring.letter_grade(91) == "A"
    assert eval_scoring.letter_grade(50) == "D"
    score, details = eval_scoring.score_coherence({"has_plan_mode": True, "has_verification": True})
    assert score == 85.0  # 50 + 15 + 20
    assert details["has_plan_mode"] is True


# ---------------------------------------------------------------------------
# MemoryRagService — DI working dir + budget/manifest split
# ---------------------------------------------------------------------------

def test_memory_rag_status_and_manifest_isolated(tmp_path):
    svc = MemoryRagService(working_dir=tmp_path / "rag", api_key="", budget_cap=2.5)
    status = svc.get_status()
    # No API key configured -> safe degraded status, no exceptions.
    assert status["status"] in {"not_started", "no_api_key"}
    assert status["budget"]["cap_usd"] == 2.5
    assert svc.list_docs() == []


def test_memory_rag_budget_helper_resets_on_new_day(tmp_path):
    from app.services import memory_rag_budget
    path = tmp_path / "budget.json"
    may30 = lambda: datetime(2026, 5, 30, tzinfo=timezone.utc)
    memory_rag_budget.save_budget(path, {"day": "2026-05-29", "spent_usd": 9.0,
                                         "input_tokens": 1, "output_tokens": 1})
    fresh = memory_rag_budget.load_budget(path, may30)
    assert fresh["spent_usd"] == 0.0  # stale day discarded
    assert fresh["day"] == "2026-05-30"


# ---------------------------------------------------------------------------
# Scanner registry + /api/health/scanners
# ---------------------------------------------------------------------------

@pytest.fixture
def app_client(monkeypatch):
    scanner_registry.reset()
    # Disable real scanners so create_app() doesn't touch the host filesystem.
    monkeypatch.setattr("app.config.CCC_DISABLE_SCANNERS", "all", raising=False)
    monkeypatch.setattr("app.services.CCC_DISABLE_SCANNERS", "all", raising=False)
    import app as app_pkg
    flask_app = app_pkg.create_app()
    return flask_app.test_client()


def test_health_scanners_endpoint(app_client):
    resp = app_client.get("/api/health/scanners")
    assert resp.status_code == 200
    body = resp.get_json()
    assert "scanners" in body
    assert body["count"] >= 1
    # With CCC_DISABLE_SCANNERS=all, every scanner is registered but disabled.
    assert body["enabled_count"] == 0
    sample = body["scanners"][0]
    for field in ("name", "enabled", "last_run", "last_error", "next_run"):
        assert field in sample


def test_disable_scanners_parsing():
    from app.services import _disabled_names
    import app.services as services
    # Named subset
    services.CCC_DISABLE_SCANNERS = "analytics, eval"
    assert _disabled_names() == {"analytics", "eval"}
    # All
    services.CCC_DISABLE_SCANNERS = "all"
    assert "analytics" in _disabled_names()
    services.CCC_DISABLE_SCANNERS = ""
    assert _disabled_names() == set()


def test_scanner_registry_heartbeat_and_next_run():
    scanner_registry.reset()
    scanner_registry.register("demo", enabled=True, interval=100.0, started=True)
    scanner_registry.heartbeat("demo")
    snap = {s["name"]: s for s in scanner_registry.snapshot()}
    assert snap["demo"]["run_count"] == 1
    assert snap["demo"]["next_run"] is not None
    assert snap["demo"]["next_run"] > snap["demo"]["last_run"]
