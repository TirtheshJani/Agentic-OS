---
name: issue-triage
description: Given a GitHub repo, pull open issues, cluster by theme, identify duplicates, and propose labels and priorities. Use when the user asks to "triage issues in [repo]", "issue cleanup", "label these issues".
license: MIT
metadata:
  status: stub
  domain: coding
  mode: remote
  mcp-server: github
  external-apis: [none]
  outputs: [vault/wiki/coding/issues-<repo>-YYYY-MM-DD.md]
---

# issue-triage

## References
- `references/services/github.md` — rate limits (anonymous search:
  10/min, authed REST: 5,000/hr), `search_issues` vs. listing, 403
  disambiguation, PR-vs-issue namespace.

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/coding/issues-<repo>-YYYY-MM-DD.md

## Examples
TODO

## Troubleshooting
TODO
