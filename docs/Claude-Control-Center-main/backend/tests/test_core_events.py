import threading
import time

from app.core import events


def test_publish_reaches_subscribers():
    received: list = []

    def consume():
        for topic, payload in events.subscribe():
            received.append((topic, payload))
            if topic == "stop":
                return

    t = threading.Thread(target=consume, daemon=True)
    t.start()
    # Give the subscriber a moment to register.
    deadline = time.monotonic() + 1.0
    while events.subscriber_count() == 0 and time.monotonic() < deadline:
        time.sleep(0.01)

    events.publish("hello", {"x": 1})
    events.publish("stop")
    t.join(timeout=2.0)
    assert ("hello", {"x": 1}) in received


def test_subscriber_slot_released_when_consumer_exits():
    before = events.subscriber_count()

    def consume():
        for topic, _ in events.subscribe():
            if topic == "stop":
                return

    t = threading.Thread(target=consume, daemon=True)
    t.start()
    deadline = time.monotonic() + 1.0
    while events.subscriber_count() <= before and time.monotonic() < deadline:
        time.sleep(0.01)
    assert events.subscriber_count() == before + 1
    events.publish("stop")
    t.join(timeout=2.0)
    assert events.subscriber_count() == before
