---
name: vault-cleanup
description: List vault/raw/ files older than a configurable threshold (default 30 days), propose moves to vault/archive/ or promotions to vault/wiki/, and apply on confirmation. Use when the user asks to "clean up the vault", "archive old notes", "vault hygiene".
license: MIT
metadata:
  status: stub
  domain: productivity
  mode: remote
  mcp-server: none
  external-apis: [none]
  outputs: [vault/archive/ (moves) and vault/wiki/<domain>/ (promotions)]
---

# vault-cleanup

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/archive/ (moves) and vault/wiki/<domain>/ (promotions)

## Examples
TODO

## Troubleshooting
TODO
