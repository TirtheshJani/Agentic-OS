"""In-process pub/sub for SSE fan-out.

Producers call ``publish(topic, payload)``. Each subscriber owns a bounded
queue; ``subscribe()`` yields ``(topic, payload)`` pairs as they arrive.

The existing ``/api/events`` SSE route can be migrated incrementally — this
module is additive and does not replace ``Watcher``.
"""
from __future__ import annotations

import queue
import threading
from typing import Any, Iterator

_DEFAULT_QUEUE_SIZE = 256
_subscribers: set[queue.Queue] = set()
_lock = threading.Lock()


def publish(topic: str, payload: Any = None) -> None:
    """Fan out an event to every active subscriber.

    Non-blocking: if a subscriber's queue is full, the event is dropped for
    that subscriber rather than stalling the publisher.
    """
    event = (topic, payload)
    with _lock:
        targets = list(_subscribers)
    for q in targets:
        try:
            q.put_nowait(event)
        except queue.Full:
            continue


def subscribe(*, max_queue: int = _DEFAULT_QUEUE_SIZE) -> Iterator[tuple[str, Any]]:
    """Yield events for the lifetime of the caller.

    Designed to be consumed inside a Flask SSE generator. Releases the
    subscriber slot when the iterator is closed (e.g. client disconnect).
    """
    q: queue.Queue = queue.Queue(maxsize=max_queue)
    with _lock:
        _subscribers.add(q)
    try:
        while True:
            yield q.get()
    finally:
        with _lock:
            _subscribers.discard(q)


def subscriber_count() -> int:
    with _lock:
        return len(_subscribers)
