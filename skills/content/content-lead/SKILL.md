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

See `skills/research/research-lead/SKILL.md` for the routing protocol
(same 3/2/1-point rubric on `description` + `allowed-skills`). Read
profiles from `agents/content/*.md`.

Current roster:
- `anxious-nomad-writer`: Substack posts, newsletter, drafts in the
  Anxious Nomad voice.

Typical inputs handed off from research-lead arrive as: "Draft a Substack
section from <vault path>." Match on "Substack", "newsletter", "draft",
"roundup", or "post" → anxious-nomad-writer.

## Project scoping (phase 7.3)

If the task has a non-null `project_slug`, load the project via the
projects-loader (or read `vault/projects/<slug>/PROJECT.md` directly).
Restrict the candidate set to teammates whose `allowed-skills` intersects
the project's `capabilities`. If the intersection is empty (no teammate
covers the project's domain), leave the task in the queue and write a
note to the task thread explaining why — do not assign someone who lacks
the capability.
