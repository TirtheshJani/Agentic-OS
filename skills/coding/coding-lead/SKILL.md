---
name: coding-lead
description: Read the coding-department queue, pick a teammate per task based on skill overlap, claim and reassign. Triggers from the dashboard 'Tick' button for coding.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: coding
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: coding-lead
  department: coding
  role: lead
---

# Coding lead — routing instructions

Same algorithm as `research-lead`. See `skills/research/research-lead/SKILL.md`
for the routing protocol. The only differences:

- Read profiles from `agents/coding/*.md` (not `agents/research/`).
- If no member agents exist, append to the thread `no coding teammates authored — holding`
  for every queued task and exit `routed: 0 handed-off, <N> held`.
