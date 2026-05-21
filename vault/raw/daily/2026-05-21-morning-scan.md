---
date: 2026-05-21
skill: morning-trend-scan
sources: [github-search-api, arxiv-atom]
---

# 2026-05-21 morning scan

## GitHub (created in last 7d, sorted by stars)

- [Kappaemme-git/codex-complexity-optimizer](https://github.com/Kappaemme-git/codex-complexity-optimizer) — 810★ · Codex skill for safe codebase complexity analysis and performance optimization reports (Python)
- [bytedance/Lance](https://github.com/bytedance/Lance) — 623★ · 3B-parameter native unified multimodal model for image/video understanding, generation, and editing (Python)
- [openclaw/clawpatch](https://github.com/openclaw/clawpatch) — 611★ · Review code. Patch bugs. Land PRs. (TypeScript)
- [sapientinc/HRM-Text](https://github.com/sapientinc/HRM-Text) — 602★ · 1B text generation model on the HRM architecture with latent space reasoning (Python)
- [evilsocket/audit](https://github.com/evilsocket/audit) — 392★ · An 8-stage vulnerability-discovery agent (Python)
- [agentic-in/elephant-agent](https://github.com/agentic-in/elephant-agent) — 376★ · Personal-model-first self-evolving AI agent (Python)
- [Helvesec/rmux](https://github.com/Helvesec/rmux) — 264★ · Universal Rust multiplexer with a typed SDK — drive any CLI or TUI app from code (Rust)
- [vadimsemenykv/saboteur](https://github.com/vadimsemenykv/saboteur) — 158★ · (no description) (Go)

## arXiv (today, cs.LG / stat.ML / cs.CL / cs.CV / physics.med-ph)

_Unavailable — see Notes._

## Notes

- **arXiv blocked**: `export.arxiv.org` returned "Host not in allowlist" (HTTP 403) from both WebFetch and direct curl. The host is not in the network policy for this remote execution environment. Validator not run. arXiv block skipped entirely.
- **GitHub source**: used `mcp__github__search_repositories` with `created:>2026-05-14 fork:false` per language (python, typescript, rust, go), sorted by stars — consistent with SKILL.md spec. Four TypeScript results (645–668★, 0 forks, SEO-stuffed descriptions) were filtered as obvious spam before selecting top 8.
- **GitHub trending page** (`https://github.com/trending`) was also fetched via WebFetch but the API-based search is more reliable for the 7-day creation window; trending page results are noted in the run log.
