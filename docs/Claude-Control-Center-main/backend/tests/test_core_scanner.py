import time
from pathlib import Path

from app.core.scanner import BackgroundScanner


def test_scanner_runs_and_writes_cache(tmp_path: Path):
    cache = tmp_path / "out.json"
    calls = {"n": 0}

    def scan():
        calls["n"] += 1
        return {"count": calls["n"]}

    scanner = BackgroundScanner("test", interval=60.0, scan_fn=scan, cache_path=cache)
    scanner.start()
    # Wait briefly for the first run.
    deadline = time.monotonic() + 2.0
    while not cache.exists() and time.monotonic() < deadline:
        time.sleep(0.01)
    scanner.stop()
    assert calls["n"] >= 1
    assert cache.exists()


def test_scanner_force_rescan_wakes_loop(tmp_path: Path):
    calls = {"n": 0}

    def scan():
        calls["n"] += 1

    scanner = BackgroundScanner("test", interval=60.0, scan_fn=scan)
    scanner.start()
    deadline = time.monotonic() + 2.0
    while calls["n"] == 0 and time.monotonic() < deadline:
        time.sleep(0.01)
    initial = calls["n"]
    scanner.force_rescan()
    deadline = time.monotonic() + 2.0
    while calls["n"] <= initial and time.monotonic() < deadline:
        time.sleep(0.01)
    scanner.stop()
    assert calls["n"] > initial


def test_scanner_records_errors(tmp_path: Path):
    def scan():
        raise RuntimeError("boom")

    scanner = BackgroundScanner("test", interval=60.0, scan_fn=scan)
    scanner.start()
    deadline = time.monotonic() + 2.0
    while scanner.status().run_count == 0 and time.monotonic() < deadline:
        time.sleep(0.01)
    scanner.stop()
    assert "boom" in (scanner.status().last_error or "")


def test_mtime_cache_skips_unchanged(tmp_path: Path):
    f = tmp_path / "x.txt"
    f.write_text("hello")
    scanner = BackgroundScanner("test", interval=60.0, scan_fn=lambda: None)
    assert scanner.mtime_cache.changed(f) is True
    assert scanner.mtime_cache.changed(f) is False
    # Touch with a different mtime.
    import os
    os.utime(f, (f.stat().st_atime, f.stat().st_mtime + 1))
    assert scanner.mtime_cache.changed(f) is True
