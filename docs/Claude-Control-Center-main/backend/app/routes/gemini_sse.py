from __future__ import annotations

import json
import time

from flask import Blueprint, Response, stream_with_context

from app.services.gemini_watcher import GeminiWatcher

bp = Blueprint("gemini_sse", __name__, url_prefix="/api/gemini/events")

_watcher = GeminiWatcher()


def _event_stream():
    _watcher.poll()  # prime snapshot without emitting events

    while True:
        events = _watcher.poll()
        for evt in events:
            yield f"event: {evt.event_type}\ndata: {json.dumps(evt.data)}\n\n"
        yield "event: ping\ndata: {}\n\n"
        time.sleep(5)


@bp.get("")
def gemini_sse():
    return Response(
        stream_with_context(_event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
