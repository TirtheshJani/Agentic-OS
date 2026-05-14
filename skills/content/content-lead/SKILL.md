---
name: content-lead
description: Read the content-department queue, pick a teammate per task. Triggers from the dashboard 'Tick' button for content.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: content
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: content-lead
  department: content
  role: lead
---

# Content lead — routing instructions

See `skills/research/research-lead/SKILL.md` for the routing protocol.
Read profiles from `agents/content/*.md`. No content members exist yet;
hold the queue with thread notes.
