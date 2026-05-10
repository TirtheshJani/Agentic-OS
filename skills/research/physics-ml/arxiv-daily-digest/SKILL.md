---
name: arxiv-daily-digest
description: Pull today's arXiv submissions in the user's physics and ML categories, summarize each in 2-3 sentences, group by theme, and write a daily digest to vault/wiki/research/physics-ml/. Use when the user asks for "arxiv digest", "today's physics papers", "ML paper roundup", or "what's new on arxiv".
license: MIT
metadata:
  status: authored
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [arxiv]
  outputs: [vault/wiki/research/physics-ml/arxiv-YYYY-MM-DD.md]
---

# arxiv-daily-digest

Daily digest of new arXiv submissions in the categories the user
follows. Aimed at "I have ten minutes, what landed today" — not at
deep summarization.

**Orchestration pattern:** sequential workflow — fetch → filter →
summarize → group → write. The script bundle handles the deterministic
fetch+parse so the model spends its tokens on summary quality.

Categories live in `references/arxiv-categories.md`. Read that before
adjusting defaults.

## Instructions

1. **Resolve the date and categories.** Default date: today. Default
   categories: from `references/arxiv-categories.md` (cs.LG, stat.ML,
   cs.CL, cs.CV, physics.med-ph).

2. **Fetch listings.** Read
   `../../../../references/services/arxiv.md` first for endpoint
   shape, query patterns, the courtesy 3s gap, and the UTC-date
   gotcha. For each category, call:
   ```
   https://export.arxiv.org/api/query
     ?search_query=cat:<cat>
     &sortBy=submittedDate&sortOrder=descending
     &max_results=50
   ```
   Parse the Atom XML. Extract: id, title, authors (first 3 + "et al"
   if more), abstract, primary category, submitted timestamp, link.
   Filter to entries whose submitted date matches the target date.
   Dedupe across categories by canonical id (strip `vN` — papers
   cross-list).

   Optional shape check on the raw response (catches arXiv-side
   format drift early):
   ```
   python ../../../../scripts/validators/validate_arxiv_atom.py response.xml
   ```

3. **Cap and prioritize.** If more than `max_papers` (default 20)
   match, keep the most-recent that also match the user's tag hints
   from `references/arxiv-categories.md` (diffusion, transformer,
   scaling, clinical, …). If still too many, keep the 20 most recent.

4. **Summarize each.** For each kept paper, write 2-3 sentences:
   what's the claim, what's the method, why it matters. Be honest
   about novelty — many arXiv submissions are incremental; saying
   so is more useful than overselling.

5. **Group by theme.** Cluster the summaries into 3-6 themes that
   emerged from today's batch (do not pre-define themes — let them
   come from the day). Each group gets a one-line lede before the
   paper bullets.

6. **Write the digest** to
   `vault/wiki/research/physics-ml/arxiv-<date>.md` with the
   frontmatter under Outputs. Append a `## Stats` line at the bottom:
   total seen, total kept, categories covered.

7. **Report** the digest path back to the user.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `date` | today | `YYYY-MM-DD`. |
| `categories` | see references | Override for specific runs. |
| `max_papers` | `20` | Hard cap for the digest body. |
| `min_abstract_chars` | `200` | Skip very short submissions (often errata). |

## Outputs

- `vault/wiki/research/physics-ml/arxiv-<date>.md` with frontmatter:
  ```yaml
  ---
  domain: research/physics-ml
  source: arxiv-daily-digest
  created: <date>
  updated: <date>
  tags: [arxiv, daily-digest]
  categories: [cs.LG, stat.ML, …]
  ---
  ```

## Example

Prompt: "arxiv digest"

Excerpt:
```markdown
# arXiv digest — 2026-05-10

## Theme: Long-context retrieval
The day's biggest cluster was about reducing token cost when context
grows past 256k.
- **2505.04321** "Compute-optimal RAG at 1M context" (Smith et al.) —
  argues token cost dominates retrieval cost above 1M; proposes a
  query-rewriter that halves prompt tokens at equal recall. Notable
  because it inverts the usual retrieval-vs-generation tradeoff.
- **2505.04305** "Retriever-as-cache for streaming LLMs" (Chen et al.)
  — incremental, mostly engineering. Useful if you're building
  streaming agents.

## Theme: Diffusion at lower precision
…

## Stats
Seen: 187. Kept: 18. Categories covered: cs.LG, cs.CL, stat.ML, cs.CV.
```

## Troubleshooting

- **arXiv API returns Atom but no entries.** Check the date filter —
  arXiv uses UTC and "today" can be empty for the first few hours.
  Fall back to the previous UTC day if the run is before 09:00 UTC.
- **Rate-limited (HTTP 503).** arXiv asks for ≥3s between requests.
  If fetching multiple categories, stagger the calls.
- **Cross-listed papers double-counted.** The dedupe step is by
  arXiv id (the canonical id ignores category). If you see duplicates
  in the digest, the dedupe step was skipped.
- **Summary feels generic.** That usually means the abstract was
  short or the paper itself was incremental. Say "incremental" or
  "engineering" rather than padding.
