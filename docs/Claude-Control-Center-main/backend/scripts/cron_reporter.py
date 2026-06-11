"""
Cron reporter — reads the host user crontab and pushes a snapshot to the live
CCC API, so the dockerized dashboard (which has no crontab) can display
discovered cron jobs on the Loops page.

Usage (from the backend directory, with the venv active or via its python):

    python -m scripts.cron_reporter             # report once
    python -m scripts.cron_reporter --install   # also add a */15 crontab entry
    python -m scripts.cron_reporter --remove    # remove the reporter's entry

Like scripts/loop_runner.py it reports via the API (the container volume is
the source of truth) and falls back to a direct file write when the API is
unreachable (host-only / dev setups).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Make `app` importable when invoked as `python -m scripts.cron_reporter`.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services import loop_cron_service  # noqa: E402

_API_BASE = os.environ.get("CCC_API_BASE", "http://127.0.0.1:5050").rstrip("/")
_MARKER = "# ccc-cron-reporter"
_SCHEDULE = "*/15 * * * *"


def _report(entries: list[dict]) -> bool:
    url = f"{_API_BASE}/api/loops/discovered/report"
    data = json.dumps({"entries": entries}).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read() or b"{}")
        print(f"reported {payload.get('count')} entries to {_API_BASE}")
        return True
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"API unreachable ({exc}); writing snapshot file directly", file=sys.stderr)
        return False


def run_once() -> int:
    discovered = loop_cron_service.discover()
    if discovered.get("source") != "live":
        print(f"cannot read crontab here: {discovered.get('error')}", file=sys.stderr)
        return 1
    entries = loop_cron_service.sanitize_entries(discovered["entries"])
    if not _report(entries):
        loop_cron_service.save_snapshot(entries)
        print(f"wrote {len(entries)} entries to data/discovered_cron.json")
    return 0


def _render_line() -> str:
    py = sys.executable or "python3"
    cmd = (
        f"cd '{_BACKEND_DIR}' && '{py}' -m scripts.cron_reporter "
        f">> data/loop_cron.log 2>&1"
    )
    return f"{_MARKER}\n{_SCHEDULE} {cmd}"


def _strip_reporter(lines: list[str]) -> list[str]:
    out: list[str] = []
    skip_next = False
    for line in lines:
        if skip_next:
            skip_next = False
            continue
        if line.strip() == _MARKER:
            skip_next = True
            continue
        out.append(line)
    return out


def install() -> int:
    lines = _strip_reporter(loop_cron_service._read_crontab())
    lines.extend(_render_line().split("\n"))
    loop_cron_service._write_crontab(lines)
    print(f"installed crontab entry: {_SCHEDULE}")
    return run_once()


def remove() -> int:
    before = loop_cron_service._read_crontab()
    after = _strip_reporter(before)
    if len(after) == len(before):
        print("no reporter entry found")
        return 0
    loop_cron_service._write_crontab(after)
    print("removed crontab entry")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Report the host crontab to CCC")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--install", action="store_true", help="install a */15 crontab entry and report now")
    group.add_argument("--remove", action="store_true", help="remove the reporter's crontab entry")
    args = parser.parse_args()
    if args.install:
        return install()
    if args.remove:
        return remove()
    return run_once()


if __name__ == "__main__":
    raise SystemExit(main())
