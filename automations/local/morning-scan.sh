#!/usr/bin/env bash
# Local automation: kick off the morning trend scan when the laptop is open.
# Per standards/automation-authoring.md.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec claude -p "Use the morning-trend-scan skill"
