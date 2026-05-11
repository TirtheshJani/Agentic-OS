---
name: repo-onboarding
description: Given a GitHub repo URL or local path, produce an onboarding doc covering structure, build/test commands, key abstractions, and likely good first issues. Use when the user asks to "onboard me to [repo]", "explain this codebase", "first-look on [repo]".
license: MIT
metadata:
  status: stub
  domain: coding
  mode: remote
  mcp-server: github
  external-apis: [none]
  outputs: [vault/wiki/coding/onboarding-<repo>.md]
---

# repo-onboarding

## References
- `references/services/github.md` — `get_file_contents` (decode base64
  for larger files), `list_commits`, scope allowlist.

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/coding/onboarding-<repo>.md

## Examples
TODO

## Troubleshooting
TODO
