"""Unified background scanner for CLI providers (Phase 2).

Replaces the three parallel ``*_session_scanner.scan_all_background`` starters.
One daemon thread per provider that declares the SCAN capability periodically
refreshes that provider's session cache by calling ``provider.scan_sessions()``
(which delegates to the provider's underlying scanner service, writing the same
cache files the legacy routes read). Adding a fifth scannable provider needs no
change here — it is picked up from the registry automatically.
"""

from __future__ import annotations

import logging
import threading
import time

from app.providers import Capability, all_providers

logger = logging.getLogger(__name__)

# Matches the interval the legacy gemini/antigravity scanners used (5 minutes).
_SCAN_INTERVAL = 300
# Stagger the first pass so startup isn't dominated by filesystem scans.
_STARTUP_DELAY = 15


def _worker(provider) -> None:
    time.sleep(_STARTUP_DELAY)
    while True:
        try:
            provider.scan_sessions()
        except Exception:  # noqa: BLE001 — a bad provider must not kill the loop
            logger.exception("scan failed for provider '%s'", provider.id)
        time.sleep(_SCAN_INTERVAL)


def scan_all_background() -> None:
    """Launch one daemon scanner thread per scannable provider."""
    for provider in all_providers():
        if not provider.supports(Capability.SCAN):
            continue
        thread = threading.Thread(
            target=_worker,
            args=(provider,),
            daemon=True,
            name=f"cli-scanner-{provider.id}",
        )
        thread.start()
