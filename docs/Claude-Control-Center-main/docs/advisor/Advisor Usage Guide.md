---
title: Advisor Usage Guide
type: guide
tags: [advisor, tool-use, optimization]
created: 2026-04-10
---

# Advisor Usage Guide

The Advisor tool lets a lighter "executor" model consult a stronger "advisor" model (Opus 4.6) mid-generation for strategic guidance.

## How It Works

1. The executor model (Haiku or Sonnet) is generating a response
2. It invokes the `advisor` tool (type `advisor_20260301`)
3. The advisor (Opus 4.6) receives the full conversation context
4. It returns 400-700 tokens of advice
5. The executor incorporates this advice into its response

## Valid Model Pairs

| Executor | Advisor | Use Case |
|----------|---------|----------|
| Haiku 4.5 | Opus 4.6 | Cost-efficient with strategic oversight |
| Sonnet 4.6 | Opus 4.6 | Balanced capability with expert consultation |
| Opus 4.6 | Opus 4.6 | Self-review for critical tasks |

## Best Practices

- **Call early**: Before substantive work, after initial orientation
- **Call before declaring done**: Deliverables should be durable before the advisor call
- **Call when stuck**: Recurring errors, approach not converging
- **Call when changing approach**: Get a second opinion on the pivot

## Tracking in Control Center

The Advisor Tracker scans Claude Code session JSONL files for:
- `server_tool_use` blocks with `name: "advisor"`
- Paired `advisor_tool_result` blocks

### Metrics Tracked

- Total invocations across all sessions
- Model pair distribution (which executor/advisor combos are used)
- Average duration per advisor call
- Success rate
- Weekly trends
- Per-project breakdown

### QMD Commands

```bash
# Scan for advisor usage
./qmd run qmd-examples/advisor-check.qmd advisor-scan

# View stats
./qmd run qmd-examples/advisor-check.qmd advisor-stats
```

## Related

- [[Integration Guide|Managed Agents Integration Guide]]
- [[Agent Configuration Templates]]
