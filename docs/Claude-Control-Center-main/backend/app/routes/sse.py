import json
import time

from flask import Blueprint, Response, stream_with_context

from app.services.watcher import Watcher

bp = Blueprint("sse", __name__, url_prefix="/api/events")

_watcher = Watcher()


def _event_stream():
    # Prime the watcher snapshot without emitting events
    _watcher.poll()

    while True:
        events = _watcher.poll()
        for evt in events:
            yield f"event: {evt.event_type}\ndata: {json.dumps(evt.data)}\n\n"
        yield "event: ping\ndata: {}\n\n"
        time.sleep(5)


@bp.get("")
def sse():
    return Response(
        stream_with_context(_event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
