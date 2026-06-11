from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


def _run(args: list[str], timeout: int, cwd: str | None = None) -> dict:
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"returncode": -1, "stdout": "", "stderr": f"Command timed out after {timeout}s"}
    except FileNotFoundError:
        return {"returncode": -1, "stdout": "", "stderr": "docker not found in PATH"}


def list_stacks() -> list[dict]:
    result = _run(["docker", "compose", "ls", "--format", "json", "--all"], timeout=15)
    if result["returncode"] != 0 or not result["stdout"].strip():
        return []
    try:
        raw = json.loads(result["stdout"])
    except json.JSONDecodeError:
        return []
    stacks = []
    for item in raw:
        stacks.append({
            "name": item.get("Name", ""),
            "status": item.get("Status", ""),
            "configFiles": item.get("ConfigFiles", ""),
        })
    return stacks


def _validate_project(project_name: str) -> dict | None:
    for stack in list_stacks():
        if stack["name"] == project_name:
            return stack
    return None


def get_stack_detail(project_name: str) -> dict:
    if not _validate_project(project_name):
        return {"error": f"Unknown project: {project_name}"}

    result = _run(["docker", "compose", "-p", project_name, "ps", "--format", "json"], timeout=15)
    if result["returncode"] != 0:
        return {"error": result["stderr"], "services": []}

    raw_output = result["stdout"].strip()
    if not raw_output:
        return {"services": []}

    services = []
    # docker compose ps --format json emits either a JSON array or NDJSON (one object per line)
    try:
        parsed = json.loads(raw_output)
        if isinstance(parsed, list):
            items = parsed
        else:
            items = [parsed]
    except json.JSONDecodeError:
        items = []
        for line in raw_output.splitlines():
            line = line.strip()
            if line:
                try:
                    items.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    for item in items:
        publishers = item.get("Publishers") or []
        ports = ", ".join(
            f"{p.get('PublishedPort', '?')}:{p.get('TargetPort', '?')}/{p.get('Protocol', 'tcp')}"
            for p in publishers
            if p.get("PublishedPort")
        )
        services.append({
            "name": item.get("Name", ""),
            "service": item.get("Service", ""),
            "state": item.get("State", ""),
            "status": item.get("Status", ""),
            "health": item.get("Health", ""),
            "ports": ports,
        })

    return {"services": services}


def stack_action(project_name: str, action: str) -> dict:
    if action not in {"start", "stop", "restart"}:
        return {"returncode": -1, "stdout": "", "stderr": f"Unknown action: {action}"}
    if not _validate_project(project_name):
        return {"returncode": -1, "stdout": "", "stderr": f"Unknown project: {project_name}"}

    return _run(["docker", "compose", "-p", project_name, action], timeout=60)


def get_logs(project_name: str, lines: int = 200) -> dict:
    if not _validate_project(project_name):
        return {"returncode": -1, "logs": "", "stderr": f"Unknown project: {project_name}"}

    lines = max(1, min(lines, 2000))
    result = _run(
        ["docker", "compose", "-p", project_name, "logs", f"--tail={lines}", "--no-color"],
        timeout=30,
    )
    return {"logs": result["stdout"], "stderr": result["stderr"], "returncode": result["returncode"]}


def redeploy_stack(project_name: str) -> dict:
    stack = _validate_project(project_name)
    if not stack:
        return {"returncode": -1, "stdout": "", "stderr": f"Unknown project: {project_name}"}

    config_files = stack.get("configFiles", "")
    if not config_files:
        return {"returncode": -1, "stdout": "", "stderr": "Could not determine project directory (no ConfigFiles)"}

    # ConfigFiles may be comma-separated; take the first entry
    first_config = config_files.split(",")[0].strip()
    project_dir = str(Path(first_config).parent.resolve())

    redeploy_script = Path(project_dir) / "redeploy.sh"
    if not redeploy_script.exists():
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": f"No redeploy.sh found in {project_dir}",
        }

    if not os.access(str(redeploy_script), os.X_OK):
        # Make it executable if the owner forgot
        try:
            redeploy_script.chmod(redeploy_script.stat().st_mode | 0o111)
        except OSError as exc:
            return {"returncode": -1, "stdout": "", "stderr": f"redeploy.sh is not executable: {exc}"}

    return _run([str(redeploy_script)], timeout=300, cwd=project_dir)
