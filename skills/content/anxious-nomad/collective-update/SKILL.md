---
name: collective-update
description: Compile recent activity (members, milestones, blockers) into a community update for the Anxious Nomad collective and write to vault/outputs/. Use when the user asks for "collective update", "community update", "anxious nomad post".
license: MIT
metadata:
  status: stub
  domain: content/anxious-nomad
  mode: remote
  mcp-server: notion+spotify
  external-apis: [none]
  outputs: [vault/outputs/<YYYY-MM-DD>-anxious-nomad-update.md]
---

# collective-update

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## MCP integrations
- Notion (existing): source of member activity, milestones, blockers.
- Spotify (`search`, `create_playlist`): build a mood-matched playlist
  for the update period and embed the playlist URL in the closing
  section. Name format: `Anxious Nomad — <YYYY-MM>`. Skip if the user
  passes `--no-playlist`.

## Inputs
TODO

## Outputs
- vault/outputs/<YYYY-MM-DD>-anxious-nomad-update.md

## Examples
TODO

## Troubleshooting
TODO
