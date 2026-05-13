---
name: paper-summary
description: Given an arXiv ID, DOI, or paper title, fetch metadata via Semantic Scholar, summarize the paper, and write a structured note to vault/wiki/research/physics-ml/. Use when the user asks to "summarize this paper", "explain arxiv 2401.XXXXX", "give me the gist of [paper]".
license: MIT
metadata:
  status: authored
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [semantic-scholar, arxiv]
  outputs: [vault/wiki/research/physics-ml/<paper-slug>.md]
---

# paper-summary

Orchestration pattern: **sequential workflow**. Five ordered stages:
resolve ID → fetch metadata → fetch full text (best effort) →
summarize against the template → write. Each stage gates the next.
Re-runs overwrite the existing note for the same paper.

This skill is for a single named paper. For a topic-wide scan prefer
`arxiv-daily-digest`; for an open-web survey prefer
`deep-web-research`; for a structured academic search prefer
`literature-review` or `paper-search`.

## References

- `references/services/arxiv.md` — Atom endpoint, the 3-second rule,
  ID extraction. Used in stage 3 when an arXiv ID is available and
  full text is needed.
- `references/services/semantic-scholar.md` — Graph API base URL, ID
  prefixes (`arXiv:`, `DOI:`), rate limits, error handling.
- `scripts/validators/validate_semantic_scholar.py` — confirms the
  paper-details response has required fields and flags missing
  recommended fields as warnings.
- `vault/CLAUDE.md` — wiki frontmatter shape and naming rules.

## Instructions

1. **Resolve the identifier.** Accept three input formats and convert
   to the Semantic Scholar `paperId` parameter:
   - **arXiv ID** (`2401.12345`, optionally with `v2`): strip the
     version suffix, prefix with `arXiv:`. Cache the bare ID for
     stage 3.
   - **DOI** (`10.1234/foo.bar`): prefix with `DOI:`. URL-encode any
     slashes when placing into the path.
   - **Semantic Scholar ID** (40-char hex sha): pass as-is.
   - **Free-text title** (no ID supplied): hit
     `GET /paper/search?query=<title>&limit=3&fields=title,year,authors`,
     pick the top match if its title matches the user's input within
     a Levenshtein ratio above 0.8. If no match, ask the user for an
     ID rather than guessing.

2. **Fetch metadata.** GET
   `https://api.semanticscholar.org/graph/v1/paper/<resolved-id>` with
   `fields=title,abstract,authors,year,venue,externalIds,tldr,
   openAccessPdf,citationCount,referenceCount,fieldsOfStudy`.
   On 404, re-check the prefix per
   `references/services/semantic-scholar.md`. On 429, back off 30s and
   retry once; if still 429, write a stub note with metadata only and
   stop. Validate the response shape:
   ```bash
   python3 scripts/validators/validate_semantic_scholar.py < /tmp/paper.json
   ```
   Exit 0 → proceed; `warnings` lists null recommended fields the
   summary template will record as "not provided". Exit 1 → required
   field missing (title or paperId); stop and surface to user. Exit 2
   → upstream returned non-JSON; back off 30s and retry once.

3. **Fetch full text (best effort).** If the abstract alone is enough
   for the user's request (default), skip this stage. Otherwise:
   - If `externalIds.ArXiv` is set, GET
     `http://arxiv.org/abs/<arxiv-id>` for the abstract page and
     `http://arxiv.org/pdf/<arxiv-id>` for the PDF. Honor the 3s
     arXiv rule from `references/services/arxiv.md`.
   - Else if `openAccessPdf.url` is set, fetch that PDF.
   - Else: full text is unavailable. Summarize from the abstract and
     mark the limitation in the note's Notes section. Do not
     fabricate method or result details.

4. **Compute the slug.** `<paper-slug>` is kebab-case, ≤50 chars,
   built from the first author's surname + year + first 3 content
   words of the title. Example: `vaswani-2017-attention-is-all`.
   If the file already exists under
   `vault/wiki/research/physics-ml/`, overwrite (this skill is
   idempotent for a given paper).

5. **Summarize against the template.** Fill the section template in
   §"Summary template" below. Every section is required; if a section
   has no source content (e.g. no results in a position paper), write
   "Not applicable" and one sentence why. Cite the paper inline by its
   primary ID (`arXiv:2401.12345` or `DOI:...`); do not invent figure
   numbers or equation references.

6. **Write** the note to
   `vault/wiki/research/physics-ml/<paper-slug>.md` with the
   frontmatter shape from `vault/CLAUDE.md`.

## Inputs

- `paper_id` (required, string). One of: arXiv ID, DOI, Semantic
  Scholar 40-char ID, or a paper title.
- `fetch_full_text` (optional, bool). Default `false`. When `true`,
  stage 3 runs and the summary can quote method or numeric details
  beyond the abstract.
- `audience` (optional, enum). `expert` | `generalist`. Default
  `generalist`. Controls jargon density in the "Method in plain
  language" section. Bibliographic header and numbers are identical
  either way.

## Outputs

- `vault/wiki/research/physics-ml/<paper-slug>.md` — the structured
  summary. This is the canonical artifact.

## Summary template

```md
---
domain: research/physics-ml
source: paper-summary
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [<fields-of-study slugs>]
---

# <Paper title>

**Authors:** <Author 1, Author 2, ... et al.>
**Year:** <YYYY>  ·  **Venue:** <venue or "arXiv preprint">
**IDs:** arXiv:<id>  ·  DOI:<doi>  ·  S2:<sha>
**Citations:** <n> (as of <YYYY-MM-DD>)

## Problem

<2–4 sentences. What gap, what question, what previously failed.>

## Method in plain language

<3–6 sentences. The core idea without the math, then one sentence
naming the formal mechanism (e.g. "implemented as a contrastive
loss over learned embeddings"). Match the requested `audience`.>

## Key results

- <Headline number with units and the baseline it beats.>
- <Second result, including the dataset or benchmark name.>
- <Third, if any. Do not pad. Quote numbers verbatim; if absent in
  the source, omit the bullet rather than estimate.>

## Limitations

- <Stated limitations from the authors.>
- <Reviewer-style limitations the authors did not mention but a
  careful reader would flag, labeled as inference.>

## Why it matters

<One paragraph. Place the paper in context: what it unlocks, what it
threatens, who builds on top of it. No hype words; concrete claims
only.>

## Notes

<Run metadata: full-text fetched or not, fallback used, citation
count snapshot date, any data quality caveats.>
```

## Examples

User: "summarize arxiv 1706.03762"

→ Stage 1: resolve to `arXiv:1706.03762`. Stage 2: Semantic Scholar
returns title "Attention Is All You Need", 8 authors led by Vaswani,
NeurIPS 2017, citation count snapshot. Stage 3: `fetch_full_text` is
false, skip. Stage 4: slug `vaswani-2017-attention-is-all`. Stage 5:
fill template; "Key results" cites BLEU 28.4 on WMT14 En-De and BLEU
41.0 on En-Fr, both from the abstract. Stage 6: write
`vault/wiki/research/physics-ml/vaswani-2017-attention-is-all.md`.

User: "give me the gist of 10.1038/nature14539, audience expert,
fetch_full_text true"

→ Stage 1: resolve to `DOI:10.1038/nature14539` (LeCun, Bengio,
Hinton — "Deep Learning"). Stage 2: metadata fetched. Stage 3:
`externalIds.ArXiv` is empty; `openAccessPdf.url` also empty (Nature
paywall). Fall through; note the limitation. Stage 5: summary uses
the abstract only; Notes records "full text unavailable, paywalled".
Stage 6: write
`vault/wiki/research/physics-ml/lecun-2015-deep-learning.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 from Semantic Scholar | Missing `arXiv:` or `DOI:` prefix | Re-prefix the ID per `references/services/semantic-scholar.md` and retry |
| 429 from Semantic Scholar | Free-tier 100-per-5min limit tripped | Back off 30s, retry once; if still 429, write stub and stop |
| Title-search returns the wrong paper | Common title, ambiguous match | Ask the user for an arXiv ID or DOI; do not guess |
| Abstract empty in response | Closed-access record without indexed body | If arXiv ID present, fetch the Atom entry; else summarize from title + venue and label the gap |
| `openAccessPdf.url` 403s | Publisher blocked the cached URL | Fall back to the arXiv PDF if available; otherwise note in the synthesis Notes |
| Slug collides with an existing note | Same author-year-keyword shortlist | Append a disambiguator (`-v2`, or 4th title word) rather than overwriting |
| `tldr` field missing | Semantic Scholar TLDR model didn't cover this paper | Skip; do not synthesize a fake TLDR. The Problem/Method sections cover it |
| Author count off in header | Atom and Graph API both permit N authors | Use "First Surname et al." past 3 authors; never index `authors[0]` only |
