---
name: morning-trend-scan
description: Scan GitHub trending repos plus the day's arXiv submissions in the user's tracked categories and write a brief morning digest to vault/raw/daily/. Use at the start of the workday or when the user asks for "morning scan", "what's trending", "daily tech roundup", "morning briefing".
license: MIT
metadata:
  status: authored
  domain: research/general
  mode: remote
  mcp-server: github
  external-apis: [arxiv]
  outputs: [vault/raw/daily/YYYY-MM-DD-morning-scan.md]
---

# morning-trend-scan

Five-minute morning briefing. Two sources, one digest, ranked so the
top of the file is enough on a busy day.

**Orchestration pattern:** multi-MCP coordination — GitHub MCP plus a
direct arXiv API call. Both fan out in parallel; the merge step is the
ranker.

## Instructions

1. **Resolve inputs.** Default tracked languages: `typescript`,
   `python`, `rust`. Default arXiv categories come from
   `skills/research/physics-ml/arxiv-daily-digest/references/arxiv-categories.md`
   (cs.LG, stat.ML, cs.CL, cs.CV, physics.med-ph). Both lists can be
   overridden by the user.

2. **Fetch GitHub trending in parallel.** GitHub doesn't expose
   `trending` via the API, so approximate it. See
   `../../../../references/services/github.md` for rate-limit shape
   (especially the 30/min search-API secondary limit — easy to hit
   when fanning out across languages). For each tracked language,
   call:
   ```
   mcp__github__search_repositories
     query: "language:<lang> created:>YYYY-MM-DD"  // last 7 days
     sort: "stars"
     order: "desc"
     perPage: 10
   ```
   Take the top 5 per language, dedupe across languages.

3. **Fetch arXiv in parallel.** See
   `../../../../references/services/arxiv.md` for endpoint params and
   the courtesy 3s gap (stagger across categories — don't fan out).
   For each category, call
   `https://export.arxiv.org/api/query?search_query=cat:<cat>&sortBy=submittedDate&sortOrder=descending&max_results=15`.
   The response is Atom XML; parse `entry/title`, `entry/summary`,
   `entry/id`, `entry/published`. Dedupe across categories by arXiv
   id. Keep the 20 newest overall.

4. **Rank.** Score each item:
   - GitHub repo: `stars_gained_in_window + 0.5 * forks_gained` (use
     `stargazers_count` as a proxy when delta isn't available).
   - arXiv paper: `1` per matching tag in the user's interests
     (`references/interests.md` if present, otherwise treat all
     equally).
   Sort descending, keep the top 12 across both sources combined.

5. **Write the digest** to
   `vault/raw/daily/<today>-morning-scan.md` with the structure under
   Outputs. Each item: one sentence describing what it is, link, and
   why it might matter (one short clause).

6. **Report** the digest path back to the user.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `languages` | `[typescript, python, rust]` | GitHub `language:` qualifiers. |
| `categories` | see arxiv-categories.md | arXiv category codes. |
| `top_n` | `12` | Combined ranked items in the digest. |
| `window_days` | `7` | GitHub "trending" lookback. |

## Outputs

- `vault/raw/daily/<today>-morning-scan.md` with frontmatter:
  ```yaml
  ---
  date: <today>
  domain: research/general
  source: morning-trend-scan
  ---
  ```
  Body sections: `## GitHub`, `## arXiv`, `## Worth a closer look`
  (the top 3 across both, hand-picked from the ranking).

## Example

Prompt: "morning scan"

Output excerpt:
```markdown
# Morning scan — 2026-05-10

## Worth a closer look
1. **togethercomputer/llama-3-tools** (TS, +1.2k★) — pluggable tool
   surface for OS Llama; relevant for the agent skills layer.
2. **arxiv:2505.04321** "Compute-optimal RAG at 1M context" — argues
   token cost dominates retrieval cost; relevant for our RAG eval work.
3. …

## GitHub
- togethercomputer/llama-3-tools (TS) — +1.2k★ in 7d.
- ml-gh/lasso-rs (Rust) — sparse linear solver in pure Rust, +480★.
…

## arXiv (5 of 20)
- 2505.04321 (cs.LG) "Compute-optimal RAG at 1M context".
- 2505.04318 (cs.CL) "Tool-augmented agents fail under budget pressure".
…
```

## Troubleshooting

- **arXiv 503 / Atom feed slow.** It's first-coffee hour, the feed
  often returns slowly. Retry once after 15s; on second failure, write
  the digest with just the GitHub section and a `_(arxiv unavailable
  this run)_` note.
- **GitHub search returns nothing.** Means the `created:>` window is
  too narrow. Widen to 14 days and note the change in the digest.
- **Ranking feels off.** The score is a starting point — it's fine to
  override the "Worth a closer look" picks with judgment. The
  instructions deliberately say "hand-picked".
- **Time zone confusion.** arXiv timestamps are UTC; convert to the
  user's local time only for display, not for filtering. The
  `<today>` filename uses local date.
