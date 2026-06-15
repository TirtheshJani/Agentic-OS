# 2026-06-15 morning scan

## GitHub (trending today — via github.com/trending)

- [freeCodeCamp/freeCodeCamp](https://github.com/freeCodeCamp/freeCodeCamp) — 447.6k★ · freeCodeCamp.org's open-source codebase and curriculum
- [jwasham/coding-interview-university](https://github.com/jwasham/coding-interview-university) — 352.1k★ · A complete computer science study plan to become a software engineer
- [krahets/hello-algo](https://github.com/krahets/hello-algo) — 126.8k★ · Animated educational resource for data structures and algorithms with multi-language implementations
- [iptv-org/iptv](https://github.com/iptv-org/iptv) — 122.5k★ · Collection of publicly available IPTV channels from all over the world
- [Raphire/Win11Debloat](https://github.com/Raphire/Win11Debloat) — 47.7k★ · PowerShell script to remove pre-installed apps and disable telemetry on Windows 11
- [rohitg00/ai-engineering-from-scratch](https://github.com/rohitg00/ai-engineering-from-scratch) — 32.7k★ · Hands-on AI engineering curriculum: learn it, build it, ship it
- [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) — 31.5k★ · Open-source live-chat, email support, omni-channel desk
- [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach) — 29.5k★ · Enables AI agents to access internet content from Twitter, Reddit, YouTube, and GitHub via CLI

## arXiv (today, cs.LG / stat.ML / cs.CL / cs.CV / physics.med-ph)

*(unavailable — see Notes)*

## Notes

- **arXiv blocked by network policy:** Outbound connections to `export.arxiv.org` are denied by the execution environment (`x-deny-reason: host_not_allowed`). The arXiv Atom API is unreachable from this container. The validator (`validate_arxiv_atom.py`) confirmed exit 2 on empty input. Per the skill spec, exit 2 warrants one retry after 60 s, but a network-level block is not transient — retry would not recover. The arXiv block is omitted from this digest. To fix: add `export.arxiv.org` to the environment's outbound allowlist.
- **GitHub source:** GitHub MCP search was not configured for this routine; trending repos were sourced from `github.com/trending` via WebFetch per routine instructions. The list reflects GitHub's own trending algorithm for today, not a filtered search by creation date or language.
