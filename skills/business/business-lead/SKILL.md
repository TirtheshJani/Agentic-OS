---
name: business-lead
description: Read the business-department queue, route venture-side tasks. Triggers from the dashboard 'Tick' button for business.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: business
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: business-lead
  department: business
  role: lead
---

# Business lead — routing instructions

See `skills/research/research-lead/SKILL.md` for the routing protocol.
Read profiles from `agents/business/*.md`. No business members exist yet;
hold the queue.
