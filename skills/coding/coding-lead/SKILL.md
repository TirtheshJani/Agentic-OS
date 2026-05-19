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

## Project scoping (phase 7.3)

If the task has a non-null `project_slug`, load the project via the
projects-loader (or read `vault/projects/<slug>/PROJECT.md` directly).
Restrict the candidate set to teammates whose `allowed-skills` intersects
the project's `capabilities`. If the intersection is empty (no teammate
covers the project's domain), leave the task in the queue and write a
note to the task thread explaining why — do not assign someone who lacks
the capability.
