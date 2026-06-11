# 2026-06-09 morning scan

## GitHub (trending this week, top 8)

- [chopratejas/headroom](https://github.com/chopratejas/headroom) — 19,835★ · Compress tool outputs, logs, files, and RAG chunks before they reach the LLM; 60–95% fewer tokens, same answers
- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — 188,311★ · The agent that grows with you
- [microsoft/markitdown](https://github.com/microsoft/markitdown) — 149,012★ · Python tool for converting files and office documents to Markdown
- [affaan-m/ECC](https://github.com/affaan-m/ECC) — 211,488★ · Agent harness performance optimization system covering skills, instincts, memory, security, and research-first development for Claude Code, Codex, Cursor and more
- [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) — 39,148★ · Gives your AI good taste; stops generation of boring, generic slop
- [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) — 36,247★ · AI agent skill that researches any topic across Reddit, X, YouTube, HN, Polymarket, and the web, then synthesizes a grounded summary
- [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) — 28,224★ · Open source NotebookLM implementation with additional flexibility and features
- [pbakaus/impeccable](https://github.com/pbakaus/impeccable) — 36,564★ · Design language that makes AI harnesses better at design

## arXiv (today, cs.LG / stat.ML / cs.CL / cs.CV / physics.med-ph)

_Skipped — see Notes._

## Notes

- **GitHub source:** GitHub MCP not used for this routine. Trending repos fetched via WebFetch of `https://github.com/trending?since=weekly` (HTML parse). Sorted by stars gained this week as returned by the trending page; top 8 shown. The skill spec calls for `search_repositories` filtered by language (python, typescript, rust, go) and creation date (last 7 days) — those language/recency filters were not applied here; results reflect all-language weekly trending instead.
- **arXiv blocked:** `export.arxiv.org` is not in the Anthropic egress gateway allowlist for this remote execution environment. Both WebFetch and direct curl returned HTTP 403 with `Host not in allowlist`. arXiv section omitted this run. To enable: add `export.arxiv.org` to the network allowlist in the environment configuration, or run this skill locally where network access is unrestricted.
