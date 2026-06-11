from flask import Blueprint, Response, jsonify, request, stream_with_context

from app.services import managed_agents, anthropic_client

bp = Blueprint("managed_agents", __name__, url_prefix="/api/agents")


def _error_response(e: Exception):
    if isinstance(e, anthropic_client.AnthropicAPIError):
        return jsonify({"error": e.message, "type": e.error_type}), e.status_code
    if isinstance(e, anthropic_client.RateLimitError):
        return jsonify({"error": str(e), "type": "rate_limit"}), 429
    return jsonify({"error": str(e), "type": "internal_error"}), 500


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@bp.get("/status")
def api_status():
    return jsonify({"has_api_key": anthropic_client.has_api_key()})


# ---------------------------------------------------------------------------
# Agents CRUD
# ---------------------------------------------------------------------------

@bp.get("")
def list_agents():
    try:
        return jsonify(managed_agents.list_agents())
    except Exception as e:
        return _error_response(e)


@bp.post("")
def create_agent():
    try:
        data = request.get_json(force=True)
        return jsonify(managed_agents.create_agent(data)), 201
    except Exception as e:
        return _error_response(e)


@bp.get("/<agent_id>")
def get_agent(agent_id: str):
    # Don't match reserved sub-routes
    if agent_id in ("environments", "sessions", "status"):
        return jsonify({"error": "not found"}), 404
    try:
        return jsonify(managed_agents.get_agent(agent_id))
    except Exception as e:
        return _error_response(e)


@bp.put("/<agent_id>")
def update_agent(agent_id: str):
    try:
        data = request.get_json(force=True)
        return jsonify(managed_agents.update_agent(agent_id, data))
    except Exception as e:
        return _error_response(e)


@bp.delete("/<agent_id>")
def delete_agent(agent_id: str):
    try:
        managed_agents.delete_agent(agent_id)
        return jsonify({"deleted": True})
    except Exception as e:
        return _error_response(e)


# ---------------------------------------------------------------------------
# Environments CRUD
# ---------------------------------------------------------------------------

@bp.get("/environments")
def list_environments():
    try:
        return jsonify(managed_agents.list_environments())
    except Exception as e:
        return _error_response(e)


@bp.post("/environments")
def create_environment():
    try:
        data = request.get_json(force=True)
        return jsonify(managed_agents.create_environment(data)), 201
    except Exception as e:
        return _error_response(e)


@bp.get("/environments/<env_id>")
def get_environment(env_id: str):
    try:
        return jsonify(managed_agents.get_environment(env_id))
    except Exception as e:
        return _error_response(e)


@bp.put("/environments/<env_id>")
def update_environment(env_id: str):
    try:
        data = request.get_json(force=True)
        return jsonify(managed_agents.update_environment(env_id, data))
    except Exception as e:
        return _error_response(e)


@bp.delete("/environments/<env_id>")
def delete_environment(env_id: str):
    try:
        managed_agents.delete_environment(env_id)
        return jsonify({"deleted": True})
    except Exception as e:
        return _error_response(e)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@bp.get("/sessions")
def list_sessions():
    try:
        agent_id = request.args.get("agent_id")
        return jsonify(managed_agents.list_sessions(agent_id))
    except Exception as e:
        return _error_response(e)


@bp.post("/sessions")
def create_session():
    try:
        data = request.get_json(force=True)
        return jsonify(managed_agents.create_session(data)), 201
    except Exception as e:
        return _error_response(e)


@bp.get("/sessions/<session_id>")
def get_session(session_id: str):
    if session_id == "events":
        return jsonify({"error": "not found"}), 404
    try:
        return jsonify(managed_agents.get_session(session_id))
    except Exception as e:
        return _error_response(e)


@bp.post("/sessions/<session_id>/message")
def send_message(session_id: str):
    try:
        data = request.get_json(force=True)
        message = data.get("message", data.get("content", ""))
        return jsonify(managed_agents.send_message(session_id, message))
    except Exception as e:
        return _error_response(e)


@bp.get("/sessions/<session_id>/events")
def stream_events(session_id: str):
    """SSE proxy for managed agent session events."""
    def generate():
        try:
            for event in managed_agents.stream_events(session_id):
                import orjson
                event_type = event.get("event", "message")
                data = orjson.dumps(event.get("data", {})).decode("utf-8")
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as e:
            import orjson
            error_data = orjson.dumps({"error": str(e)}).decode("utf-8")
            yield f"event: error\ndata: {error_data}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
