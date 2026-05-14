---
name: productivity-lead
description: Read the productivity-department queue, route daily-ops tasks. Triggers from the dashboard 'Tick' button for productivity.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: productivity
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: productivity-lead
  department: productivity
  role: lead
---

# Productivity lead — routing instructions

See `skills/research/research-lead/SKILL.md` for the routing protocol.
Read profiles from `agents/productivity/*.md`. The existing inbox-triage,
daily-rollup, vault-cleanup are tool-style skills, not agent-routed.
For each queued task, append thread note `running directly — no agent indirection`
and claim to `assignee: user` so the workbench can pick it up directly.
