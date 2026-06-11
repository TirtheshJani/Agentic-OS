"""Tests for the unified /api/cli/<provider>/... routes."""

from __future__ import annotations

import pytest

from app import create_app
from app.providers import get_provider


@pytest.fixture
def client():
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()


def _xhr():
    return {"X-Requested-With": "XMLHttpRequest"}


def test_providers_listing(client):
    resp = client.get("/api/cli/providers")
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.get_json()}
    assert ids == {"claude", "codex-cli", "gemini", "antigravity"}


def test_unknown_provider_404(client):
    resp = client.get("/api/cli/nope/sessions")
    assert resp.status_code == 404
    assert resp.get_json()["error"]["code"] == "unknown_provider"


def test_unsupported_capability_404(client):
    # Claude does not declare the SESSIONS capability.
    resp = client.get("/api/cli/claude/sessions")
    assert resp.status_code == 404
    assert resp.get_json()["error"]["code"] == "unsupported"


def test_sessions_filter_sort_paginate(client, monkeypatch):
    sample = [
        {"session_id": "a", "project": "p1", "first_ts": "2026-01-01", "total_tool_calls": 5},
        {"session_id": "b", "project": "p2", "first_ts": "2026-02-01", "total_tool_calls": 1},
        {"session_id": "c", "project": "p1", "first_ts": "2026-03-01", "archived": True},
    ]
    monkeypatch.setattr(get_provider("gemini"), "load_sessions", lambda: list(sample))

    # default: archived excluded, newest first
    resp = client.get("/api/cli/gemini/sessions")
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["total"] == 2
    assert [s["session_id"] for s in body["items"]] == ["b", "a"]

    # project filter
    resp = client.get("/api/cli/gemini/sessions?project=p1")
    assert {s["session_id"] for s in resp.get_json()["items"]} == {"a"}

    # include archived + sort tools
    resp = client.get("/api/cli/gemini/sessions?include_archived=1&sort=tools")
    items = resp.get_json()["items"]
    assert items[0]["session_id"] == "a"
    assert len(items) == 3


def test_session_detail_not_found(client, monkeypatch):
    monkeypatch.setattr(get_provider("gemini"), "get_session", lambda sid: None)
    resp = client.get("/api/cli/gemini/sessions/missing")
    assert resp.status_code == 404
    assert resp.get_json()["error"]["code"] == "not_found"


def test_session_detail_found(client, monkeypatch):
    monkeypatch.setattr(
        get_provider("gemini"),
        "get_session",
        lambda sid: {"summary": {"session_id": sid}, "events": []},
    )
    resp = client.get("/api/cli/gemini/sessions/abc")
    assert resp.status_code == 200
    assert resp.get_json()["summary"]["session_id"] == "abc"


def test_scan_endpoint(client, monkeypatch):
    monkeypatch.setattr(
        get_provider("antigravity"), "scan_sessions", lambda: {"scanned": 3, "stats": {}}
    )
    resp = client.post("/api/cli/antigravity/sessions/scan", headers=_xhr())
    assert resp.status_code == 200
    assert resp.get_json()["scanned"] == 3


def test_session_meta_requires_capability(client):
    # Antigravity has no SESSION_META capability.
    resp = client.patch(
        "/api/cli/antigravity/sessions/x/meta",
        json={"starred": True},
        headers=_xhr(),
    )
    assert resp.status_code == 404
    assert resp.get_json()["error"]["code"] == "unsupported"


def test_session_meta_update(client, monkeypatch):
    monkeypatch.setattr(
        get_provider("codex-cli"),
        "update_session_meta",
        lambda sid, changes: {**changes, "session_id": sid},
    )
    resp = client.patch(
        "/api/cli/codex-cli/sessions/s1/meta",
        json={"starred": True},
        headers=_xhr(),
    )
    assert resp.status_code == 200
    assert resp.get_json()["meta"]["starred"] is True


def test_analytics_stats(client, monkeypatch):
    monkeypatch.setattr(
        get_provider("gemini"), "session_stats", lambda days: {"days": days, "ok": True}
    )
    resp = client.get("/api/cli/gemini/analytics/stats?days=7")
    assert resp.status_code == 200
    assert resp.get_json()["days"] == 7


def test_scan_route_precedence_over_session_id(client, monkeypatch):
    """POST /sessions/scan must hit the scan view, not get_session('scan')."""
    called = {"scan": False}

    def fake_scan():
        called["scan"] = True
        return {"scanned": 0, "stats": {}}

    monkeypatch.setattr(get_provider("gemini"), "scan_sessions", fake_scan)
    resp = client.post("/api/cli/gemini/sessions/scan", headers=_xhr())
    assert resp.status_code == 200
    assert called["scan"] is True
