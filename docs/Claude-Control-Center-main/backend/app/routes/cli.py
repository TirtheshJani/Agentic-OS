"""Unified CLI provider routes (Phase 2).

A single blueprint serves ``/api/cli/<provider>/{sessions,skills,settings,
memory,analytics}`` for every registered provider, replacing the four parallel
``codex_cli_* / gemini_* / antigravity_*`` blueprint sets. The legacy
blueprints remain registered as thin aliases for one release.
"""

from __future__ import annotations

from functools import wraps

from flask import Blueprint, request

from app.core.responses import err, ok
from app.providers import Capability, get_provider, provider_metadata

bp = Blueprint("cli", __name__, url_prefix="/api/cli")


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    lowered = value.strip().lower()
    if lowered in ("1", "true", "yes", "on"):
        return True
    if lowered in ("0", "false", "no", "off"):
        return False
    return None


def with_provider(capability: str):
    """Resolve ``<provider_id>`` from the URL and enforce *capability*.

    The wrapped view receives the resolved provider as its first argument in
    place of the raw ``provider_id`` path segment. Unknown providers and
    unsupported capabilities short-circuit to a 404 before the view runs.
    """

    def decorator(view):
        @wraps(view)
        def wrapper(provider_id: str, *args, **kwargs):
            provider = get_provider(provider_id)
            if provider is None:
                return err(
                    f"unknown provider '{provider_id}'",
                    status=404,
                    code="unknown_provider",
                )
            if not provider.supports(capability):
                return err(
                    f"provider '{provider_id}' does not support '{capability}'",
                    status=404,
                    code="unsupported",
                )
            return view(provider, *args, **kwargs)

        return wrapper

    return decorator


def _filter_sort_paginate(sessions: list[dict]) -> dict:
    """Apply the union of cross-provider query filters, then sort + paginate.

    Filters are only applied when their query param is present, so a provider
    whose sessions lack a given field (and whose UI never sends that param)
    behaves exactly as its legacy route did.
    """
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(int(request.args.get("limit", 20)), 200))
        min_tools = max(0, int(request.args.get("min_tools", 0)))
    except (TypeError, ValueError):
        raise ValueError("invalid pagination/filter parameters")

    project_filter = request.args.get("project", "").strip()
    model_filter = request.args.get("model", "").strip()
    source_filter = request.args.get("source", "").strip()
    search = request.args.get("search", "").strip().lower()
    sort_by = request.args.get("sort", "newest").strip().lower()
    starred = _parse_bool(request.args.get("starred"))
    include_archived = _parse_bool(request.args.get("include_archived")) or False

    if project_filter:
        sessions = [s for s in sessions if s.get("project") == project_filter]
    if model_filter:
        sessions = [s for s in sessions if s.get("model") == model_filter]
    if source_filter:
        sessions = [s for s in sessions if s.get("source") == source_filter]
    if min_tools > 0:
        sessions = [s for s in sessions if (s.get("total_tool_calls") or 0) >= min_tools]
    if starred is True:
        sessions = [s for s in sessions if s.get("starred")]
    if not include_archived:
        sessions = [s for s in sessions if not s.get("archived")]
    if search:
        sessions = [
            s
            for s in sessions
            if search in (s.get("task_text") or "").lower()
            or search in (s.get("project") or "").lower()
            or search in (s.get("session_id") or "").lower()
            or search in (s.get("note") or "").lower()
        ]

    if sort_by == "oldest":
        sessions = sorted(sessions, key=lambda s: s.get("first_ts") or "")
    elif sort_by == "duration":
        sessions = sorted(sessions, key=lambda s: s.get("duration_seconds") or 0, reverse=True)
    elif sort_by == "tools":
        sessions = sorted(sessions, key=lambda s: s.get("total_tool_calls") or 0, reverse=True)
    elif sort_by == "turns":
        sessions = sorted(
            sessions,
            key=lambda s: (s.get("user_turn_count") or 0) + (s.get("agent_turn_count") or 0),
            reverse=True,
        )
    else:
        sessions = sorted(sessions, key=lambda s: s.get("first_ts") or "", reverse=True)

    total = len(sessions)
    offset = (page - 1) * limit
    return {"total": total, "page": page, "limit": limit, "items": sessions[offset : offset + limit]}


def _days_param() -> int | None:
    days_param = request.args.get("days", "30")
    return None if days_param == "all" else int(days_param)


# -- provider discovery -------------------------------------------------------
@bp.get("/providers")
def list_providers():
    return ok(provider_metadata())


# -- sessions -----------------------------------------------------------------
@bp.get("/<provider_id>/sessions")
@with_provider(Capability.SESSIONS)
def list_sessions(provider):
    try:
        return ok(_filter_sort_paginate(provider.load_sessions()))
    except ValueError as exc:
        return err(str(exc), status=400)


@bp.post("/<provider_id>/sessions/scan")
@with_provider(Capability.SCAN)
def scan_sessions(provider):
    return ok(provider.scan_sessions())


@bp.get("/<provider_id>/sessions/<session_id>")
@with_provider(Capability.SESSIONS)
def get_session(provider, session_id: str):
    result = provider.get_session(session_id)
    if result is None:
        return err("not found", status=404, code="not_found")
    return ok(result)


@bp.patch("/<provider_id>/sessions/<session_id>/meta")
@with_provider(Capability.SESSION_META)
def update_session_meta(provider, session_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return err("expected JSON object body", status=400)
    try:
        meta = provider.update_session_meta(session_id, payload)
    except ValueError as exc:
        return err(str(exc), status=400)
    return ok({"session_id": session_id, "meta": meta})


# -- analytics ----------------------------------------------------------------
@bp.get("/<provider_id>/analytics/stats")
@with_provider(Capability.ANALYTICS)
def analytics_stats(provider):
    return ok(provider.session_stats(_days_param()))


@bp.post("/<provider_id>/analytics/scan")
@with_provider(Capability.SCAN)
def analytics_scan(provider):
    return ok(provider.scan_sessions())


# -- skills / settings / memory ----------------------------------------------
@bp.get("/<provider_id>/skills")
@with_provider(Capability.SKILLS)
def list_skills(provider):
    return ok(provider.read_skills())


@bp.get("/<provider_id>/settings")
@with_provider(Capability.SETTINGS)
def read_settings(provider):
    return ok(provider.read_settings())


@bp.get("/<provider_id>/memory")
@with_provider(Capability.MEMORY)
def read_memory(provider):
    return ok(provider.read_memory(**request.args.to_dict()))
