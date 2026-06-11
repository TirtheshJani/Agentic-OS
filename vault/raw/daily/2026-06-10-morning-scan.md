# 2026-06-10 morning scan

## GitHub (trending today, via github.com/trending)
- [obra/superpowers](https://github.com/obra/superpowers) — 223.1k★ · An agentic skills framework & software development methodology that works
- [x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) — 139.4k★ · Comprehensive collection of system prompts and internal tools from popular AI coding platforms
- [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) — 84.5k★ · AI-powered tool for generating high-definition short videos with a single click
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — 50.4k★ · Production-grade engineering skills for AI coding agents
- [roboflow/supervision](https://github.com/roboflow/supervision) — 43.4k★ · We write your reusable computer vision tools
- [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) — 38.7k★ · AI agent skill researching topics across Reddit, X, YouTube, HN, and Polymarket with synthesized summaries
- [soxoj/maigret](https://github.com/soxoj/maigret) — 31.7k★ · Collect a dossier on a person by username from 3000+ sites
- [apple/container](https://github.com/apple/container) — 28.6k★ · Swift-based tool for creating and running Linux containers using lightweight VMs on Mac

## arXiv (today, cs.LG / stat.ML / cs.AI / cs.CL / cs.CV)
*(skipped — see Notes)*

## Notes
- **GitHub source:** Data pulled from `github.com/trending` HTML. The trending page does not filter by creation date; results reflect overall trending repos rather than the "created in last 7d, sorted by stars" criterion in the skill spec. No GitHub MCP `search_repositories` call was made per session instructions.
- **arXiv block (exit 2):** All requests to `export.arxiv.org` and `arxiv.org` returned HTTP 403 with `x-deny-reason: host_not_allowed`. The remote execution environment's network policy does not permit outbound connections to those domains. The arXiv Atom validator (`scripts/validators/validate_arxiv_atom.py`) returned exit 2 on empty input (`{"ok": false, "count": 0, "errors": ["empty input"]}`). One retry was attempted; result unchanged. arXiv block skipped per fail-soft design.
