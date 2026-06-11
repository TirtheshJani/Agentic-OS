from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path

from app.services import gws_audit

_BINARY_LOCK = threading.Lock()
_GWS_BINARY: Path | None = None

# Sandbox directory for --output files requested through the executor
_OUTPUTS_DIR = Path(__file__).parent.parent.parent / "data" / "gws_outputs"

_MAX_OUTPUT_BYTES = 1024 * 1024  # 1 MB

ALLOWED_SERVICES: frozenset[str] = frozenset({
    "gmail", "drive", "calendar", "sheets", "docs", "chat", "tasks",
    "people", "forms", "keep", "slides", "classroom", "meet", "script",
    "workflow", "admin-reports", "events", "modelarmor", "schema",
})

_FORBIDDEN_RE = re.compile(r'[;|&`\n\r\x00]|\$\(')

_ALLOWED_FLAGS: frozenset[str] = frozenset({
    "--params", "--json", "--upload", "--upload-content-type", "--output",
    "--format", "--api-version", "--page-all", "--page-limit", "--page-delay",
    "--dry-run", "--sanitize", "--help", "--max", "--timezone", "--today",
    "--message-id", "--to", "--subject", "--body", "--name", "--values",
    "--spreadsheet", "--upload-content-type",
})

_EXECUTOR_SEMAPHORE = threading.Semaphore(3)


def resolve_binary() -> Path | None:
    global _GWS_BINARY
    with _BINARY_LOCK:
        if _GWS_BINARY is not None:
            return _GWS_BINARY
        candidates = [
            os.environ.get("GWS_BINARY"),
            shutil.which("gws"),
            str(Path.home() / ".nvm/versions/node/v24.11.1/bin/gws"),
        ]
        for candidate in candidates:
            if candidate:
                p = Path(candidate)
                if p.exists() and os.access(p, os.X_OK):
                    _GWS_BINARY = p
                    return _GWS_BINARY
        return None


def validate_args(args: list[str]) -> None:
    if not args:
        raise ValueError("No arguments provided")
    if args[0] not in ALLOWED_SERVICES:
        raise ValueError(f"Service '{args[0]}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_SERVICES))}")
    for i, arg in enumerate(args):
        if _FORBIDDEN_RE.search(arg):
            raise ValueError(f"Argument {i} contains forbidden characters")
        # Validate --output and --upload paths stay within sandbox
        if arg in ("--output", "--upload") and i + 1 < len(args):
            target = Path(args[i + 1]).resolve()
            if arg == "--output":
                _OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
                sandbox = _OUTPUTS_DIR.resolve()
                if not str(target).startswith(str(sandbox)):
                    raise ValueError(f"--output path must be inside the gws_outputs sandbox: {sandbox}")
            # --upload: file must exist and be readable (no path escape check needed for reads)
            if arg == "--upload":
                if not target.exists():
                    raise ValueError(f"--upload file does not exist: {target}")


def _build_env() -> dict[str, str]:
    gws_bin = resolve_binary()
    bin_parent = str(gws_bin.parent) if gws_bin else ""
    path_parts = [p for p in [bin_parent, "/usr/local/bin", "/usr/bin", "/bin"] if p]
    env: dict[str, str] = {
        "HOME": str(Path.home()),
        "PATH": ":".join(path_parts),
    }
    # Pass through gws-specific env vars so Docker deployments work correctly
    for key in (
        "GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND",
        "GOOGLE_WORKSPACE_CLI_CONFIG_DIR",
        "GOOGLE_WORKSPACE_CLI_TOKEN",
        "GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE",
    ):
        val = os.environ.get(key)
        if val:
            env[key] = val
    return env


def run_command(args: list[str], timeout: int = 30, source: str = "manual") -> dict:
    gws_bin = resolve_binary()
    if gws_bin is None:
        return {"stdout": "", "stderr": "gws binary not found", "returncode": -1, "duration_ms": 0, "truncated": False}

    validate_args(args)

    if not _EXECUTOR_SEMAPHORE.acquire(blocking=False):
        raise RuntimeError("Too many concurrent gws executions (max 3)")

    t0 = time.monotonic()
    try:
        result = subprocess.run(
            [str(gws_bin)] + args,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=_build_env(),
        )
    except subprocess.TimeoutExpired:
        _EXECUTOR_SEMAPHORE.release()
        raise
    finally:
        _EXECUTOR_SEMAPHORE.release()

    duration_ms = int((time.monotonic() - t0) * 1000)

    truncated = False
    stdout = result.stdout
    if len(stdout.encode()) > _MAX_OUTPUT_BYTES:
        stdout = stdout.encode()[:_MAX_OUTPUT_BYTES].decode(errors="replace")
        truncated = True

    service = args[0] if args else ""
    gws_audit.append({
        "source": source,
        "service": service,
        "full_args": args,
        "returncode": result.returncode,
        "duration_ms": duration_ms,
        "output_snippet": stdout[:500],
        "error_snippet": result.stderr[:200] if result.stderr else "",
    })

    return {
        "stdout": stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
        "duration_ms": duration_ms,
        "truncated": truncated,
    }


def stream_command(args: list[str], timeout: int = 120, source: str = "manual"):
    gws_bin = resolve_binary()
    if gws_bin is None:
        yield "data: gws binary not found\n\n"
        return

    validate_args(args)

    if not _EXECUTOR_SEMAPHORE.acquire(blocking=False):
        yield "data: Too many concurrent executions\n\n"
        return

    service = args[0] if args else ""
    t0 = time.monotonic()
    output_lines: list[str] = []

    try:
        proc = subprocess.Popen(
            [str(gws_bin)] + args,
            shell=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=_build_env(),
        )
        deadline = time.monotonic() + timeout
        for line in proc.stdout:  # type: ignore[union-attr]
            if time.monotonic() > deadline:
                proc.kill()
                yield "data: [timeout]\n\n"
                break
            output_lines.append(line)
            yield f"data: {line.rstrip()}\n\n"
        proc.wait()
        returncode = proc.returncode
    finally:
        _EXECUTOR_SEMAPHORE.release()

    duration_ms = int((time.monotonic() - t0) * 1000)
    snippet = "".join(output_lines)[:500]
    gws_audit.append({
        "source": source,
        "service": service,
        "full_args": args,
        "returncode": returncode,
        "duration_ms": duration_ms,
        "output_snippet": snippet,
        "error_snippet": "",
    })
    yield "data: [done]\n\n"
