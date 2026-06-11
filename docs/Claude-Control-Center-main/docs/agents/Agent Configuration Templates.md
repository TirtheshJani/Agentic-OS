---
title: Agent Configuration Templates
type: reference
tags: [managed-agents, templates, configuration]
created: 2026-04-10
---

# Agent Configuration Templates

Common agent configurations for the Managed Agents API.

## Code Assistant Agent

```json
{
  "name": "Code Assistant",
  "model": "claude-sonnet-4-6",
  "system": "You are a helpful coding assistant. Write clean, well-tested code.",
  "tools": [
    { "type": "bash", "name": "Bash" },
    { "type": "file", "name": "Read" },
    { "type": "file", "name": "Write" },
    { "type": "file", "name": "Edit" },
    { "type": "search", "name": "Grep" },
    { "type": "search", "name": "Glob" }
  ]
}
```

## Research Agent

```json
{
  "name": "Research Agent",
  "model": "claude-opus-4-6",
  "system": "You are a thorough researcher. Search the web, analyze sources, and provide comprehensive answers with citations.",
  "tools": [
    { "type": "web", "name": "WebSearch" },
    { "type": "web", "name": "WebFetch" },
    { "type": "file", "name": "Read" },
    { "type": "file", "name": "Write" }
  ]
}
```

## Lightweight Task Agent

```json
{
  "name": "Quick Task",
  "model": "claude-haiku-4-5-20251001",
  "system": "You handle quick, focused tasks efficiently. Keep responses concise.",
  "tools": [
    { "type": "bash", "name": "Bash" },
    { "type": "file", "name": "Read" }
  ]
}
```

## Advisor-Enhanced Agent

Uses the [[Advisor Usage Guide|advisor tool]] for complex decisions:

```json
{
  "name": "Advisor-Enhanced Coder",
  "model": "claude-sonnet-4-6",
  "system": "You are a coding assistant. Use the advisor tool before making architectural decisions or when stuck.",
  "tools": [
    { "type": "bash", "name": "Bash" },
    { "type": "file", "name": "Read" },
    { "type": "file", "name": "Write" },
    { "type": "file", "name": "Edit" },
    { "type": "advisor_20260301", "name": "advisor", "model": "claude-opus-4-6" }
  ]
}
```
