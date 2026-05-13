---
name: deep-web-research
description: Run a deep web research session on a given topic using Firecrawl for crawling and the Drive MCP for storing source PDFs/screenshots, then write a synthesis to vault/wiki/research/general/. Use when the user asks for "deep research on X", "comprehensive web research", "crawl and summarize sources for X", or "do a literature scan on X".
license: MIT
metadata:
  status: authored
  domain: research/general
  mode: remote
  mcp-server: drive
  external-apis: [firecrawl]
  outputs: [vault/wiki/research/general/<topic-slug>.md]
---

# deep-web-research

Orchestration pattern: **sequential workflow** with one iterative
refinement loop on coverage gaps. Six stages, each gates the next.
Stage 6 may loop back to stage 2 once; never twice.

This skill is for the open web. For academic papers prefer
`paper-search`, `literature-review`, or `research-lookup`. For
existing vault material prefer `substack/draft-from-vault`.

## References

- `references/firecrawl-tips.md` — rate limits, content selectors,
  pagination, JS/CAPTCHA pitfalls. Consult before any scrape call.
- Drive MCP tools: `mcp__claude_ai_Google_Drive__create_file`,
  `mcp__claude_ai_Google_Drive__copy_file`. Used in stage 4 for
  archival of raw source bodies.
- `vault/CLAUDE.md` — wiki frontmatter shape and naming rules.

## Instructions

1. **Plan.** Restate the topic in one sentence. Decompose into 3–5
   sub-questions that, if answered, would cover the topic. Pick a
   kebab-case `<topic-slug>` (≤40 chars). If the user supplied seed
   URLs, list them; otherwise the next stage discovers them.

2. **Discover.** For each sub-question, gather candidate URLs:
   - Prefer the user's `seed_urls` if provided.
   - Else search the open web (WebSearch tool, or Firecrawl
     `/v1/search` with `q=<sub-question>`, `limit=5`).
   - Deduplicate by domain+path. Cap total candidates at `max_sources`
     (default 12; deep=20; shallow=6). Skip paywalled, login-gated,
     and obviously low-quality domains (content farms, scraper
     aggregators).

3. **Crawl and extract.** For each URL, use Firecrawl `/v1/scrape`
   with `formats: ["markdown"]` and selector hints from
   `references/firecrawl-tips.md`. For JS-rendered pages add
   `pageOptions: { waitFor: 2000 }`. Capture: title, canonical URL,
   author (if present), published date, full markdown body. Detect
   Cloudflare challenge bodies (`cf-challenge`, `Just a moment...`)
   and drop those entries. Respect 429 with the Retry-After header;
   never retry more than twice per URL.

4. **Archive sources.** For every successful scrape, write the raw
   markdown to Drive under
   `agentic-os/research/<topic-slug>/<YYYY-MM-DD>/<source-slug>.md`
   via `mcp__claude_ai_Google_Drive__create_file`. The local vault
   only keeps the synthesis; full bodies live in Drive so the vault
   stays light. Record the Drive file ID alongside each source for
   the citations block.

5. **Synthesize.** Write `vault/wiki/research/general/<topic-slug>.md`
   using the template in §"Synthesis template" below. Each claim in
   the body cites at least one source by `[^N]` footnote keyed to the
   sources list. Do not invent facts; if no source supports a claim,
   omit it or label it explicitly as inference.

6. **Gap check.** Reread the synthesis against the stage-1
   sub-questions. If any sub-question is unanswered or thinly
   sourced (<2 sources), loop **once** back to stage 2 with that
   sub-question only and `max_sources=4`. Mark the second pass in the
   synthesis's "Notes" section. Do not loop twice; report the gap
   instead.

## Inputs

- `topic` (required, string). Free text. Stage 1 converts it to
  `<topic-slug>`.
- `depth` (optional). `shallow` | `standard` | `deep`. Default
  `standard`. Controls `max_sources` and whether stage 6 may loop.
- `max_sources` (optional, int). Overrides the depth default.
- `seed_urls` (optional, list of URLs). Skips Firecrawl `/search`
  for those URLs and routes them straight to stage 3.

Depth presets:

| Depth | max_sources | gap-loop allowed |
|---|---|---|
| `shallow` | 6 | no |
| `standard` | 12 | yes (once) |
| `deep` | 20 | yes (once) |

## Outputs

- `vault/wiki/research/general/<topic-slug>.md` — the synthesis. This
  is the canonical artifact and the one the dashboard surfaces.
- Drive folder
  `agentic-os/research/<topic-slug>/<YYYY-MM-DD>/` — raw scraped
  bodies, one file per source. Referenced by Drive file ID in the
  synthesis citations.

## Synthesis template

```md
---
domain: research/general
source: deep-web-research
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [<topic-keywords>]
---

# <Topic, human title-case>

> One-sentence framing of the topic and why it matters now.

## Sub-questions

1. <sub-question 1>
2. <sub-question 2>
...

## Findings

### <sub-question 1>

<2–4 paragraphs of synthesis with footnote citations [^1][^2].>

### <sub-question 2>
...

## Open questions

- <Things the sources disagree on or do not cover.>

## Sources

[^1]: <Title> — <author or site>, <YYYY-MM-DD>. <canonical URL>.
       Drive: <file_id>.
[^2]: ...

## Notes

<Run metadata: stage-6 loop fired or not, sources skipped and why.>
```

## Examples

User: "deep research on small language models for edge devices, depth deep"

→ Stage 1: slug `slm-edge-devices`. Sub-questions: (a) state of the
art mid-2026, (b) hardware constraints, (c) quantization methods,
(d) on-device fine-tuning, (e) deployment toolchains. Stage 2:
WebSearch + Firecrawl `/search` returns 27 candidates; dedupe to 20.
Stage 3: 18 scrapes succeed, 1 Cloudflare-blocked, 1 paywalled
(dropped, noted). Stage 4: 18 source bodies written to Drive folder
`agentic-os/research/slm-edge-devices/2026-05-13/`. Stage 5:
synthesis written to
`vault/wiki/research/general/slm-edge-devices.md` with 18 footnoted
sources. Stage 6: sub-question (d) has only one source; loop back
once with `max_sources=4`, find 3 more, update synthesis, log the
loop in Notes.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Firecrawl 429 on first call | Free tier 10 req/min tripped | Honor Retry-After; sequentialize stage 3 instead of parallel |
| Scrape returns empty markdown | JS-rendered SPA | Re-scrape with `pageOptions: { waitFor: 2000 }` per `firecrawl-tips.md` |
| Drive `create_file` rejects path | Folder does not exist yet | Create the parent folder first; Drive MCP requires explicit folder creation |
| Synthesis has uncited claims | Footnote step skipped | Re-run stage 5; every paragraph needs at least one `[^N]` or an inference label |
| Gap-loop fires twice | Stage 6 logic ran without the once-only guard | Stop. Write a "coverage gap" entry in Notes and surface to user |
| All sources from one domain | Search returned a single dominant site | Force diversity: drop to ≤3 per domain in stage 2 dedupe and re-search |
| `<topic-slug>` already exists in wiki | Prior run on same topic | Append `-v2` to the slug; do not overwrite — the prior synthesis may have edits |
