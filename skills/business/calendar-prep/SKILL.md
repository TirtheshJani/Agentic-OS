---
name: calendar-prep
description: Read today's calendar events, pull related context (notes, prior meetings, attached docs) for each, and write a prep doc. Use when the user asks for "prep my day", "calendar prep", "what's on the schedule".
license: MIT
metadata:
  status: stub
  domain: business
  mode: remote
  mcp-server: calendar
  external-apis: [none]
  outputs: [vault/wiki/business/calendar-YYYY-MM-DD.md]
---

# calendar-prep

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## References
- `../../../references/services/calendar.md` — Calendar MCP scopes,
  `singleEvents=true` for recurring expansion, all-day-event date
  shape (exclusive `end.date`), and how to filter declined events.

## Inputs
TODO

## Outputs
- vault/wiki/business/calendar-YYYY-MM-DD.md

## Examples
TODO

## Troubleshooting
TODO
