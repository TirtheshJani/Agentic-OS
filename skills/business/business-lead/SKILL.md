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

## Project scoping (phase 7.3)

If the task has a non-null `project_slug`, load the project via the
projects-loader (or read `vault/projects/<slug>/PROJECT.md` directly).
Restrict the candidate set to teammates whose `allowed-skills` intersects
the project's `capabilities`. If the intersection is empty (no teammate
covers the project's domain), leave the task in the queue and write a
note to the task thread explaining why — do not assign someone who lacks
the capability.
