#!/usr/bin/env bash
# Local automation: refresh the vault-recall semantic index.
# Per standards/automation-authoring.md.
set -euo pipefail
cd "$(dirname "$0")/../.."
cd skills/_meta/vault-recall
exec node scripts/index.mjs "$@"
