---
name: comment-digest
description: Pull recent Substack/community comments from Gmail, group by post, summarize sentiment, and surface comments that warrant a personal reply. Use when the user asks for "comment digest", "recent comments", "who replied this week".
license: MIT
metadata:
  status: stub
  domain: content/community
  mode: remote
  mcp-server: gmail
  external-apis: [none]
  outputs: [vault/wiki/content/community/comments-YYYY-MM-DD.md]
---

# comment-digest

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## References
- `../../../../references/services/gmail.md` — Gmail MCP scopes,
  threads-vs-messages, indexing-lag, and the privacy rule (thread
  bodies never go to vault).

## Inputs
TODO

## Outputs
- vault/wiki/content/community/comments-YYYY-MM-DD.md

## Examples
TODO

## Troubleshooting
TODO
