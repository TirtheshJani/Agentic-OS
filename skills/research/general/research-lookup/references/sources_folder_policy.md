# Save All Results to Sources Folder

Every research-lookup result MUST be saved to the project's `sources/` folder. This is non-negotiable: research results are expensive to obtain and critical for reproducibility.

## Saving Rules

| Backend | `-o` Flag Target | Filename Pattern |
|---------|-----------------|------------------|
| parallel-cli search (default) | `sources/research_<topic>.json` | `research_<brief_topic>.json` or `research_<brief_topic>-academic.json` |
| Parallel Deep Research | `sources/research_<topic>.md` | `research_YYYYMMDD_HHMMSS_<brief_topic>.md` |
| Perplexity (academic) | `sources/papers_<topic>.md` | `papers_YYYYMMDD_HHMMSS_<brief_topic>.md` |
| Batch queries | `sources/batch_<topic>.md` | `batch_research_YYYYMMDD_HHMMSS_<brief_topic>.md` |

## How to Save

CRITICAL: every search MUST save results to the `sources/` folder using the `-o` flag.

CRITICAL: saved files MUST preserve all citations, source URLs, and DOIs.

```bash
# parallel-cli search (DEFAULT). Save JSON to sources/.
parallel-cli search "Recent advances in CRISPR gene editing 2025" \
  -q "CRISPR" -q "gene editing" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --include-domains "scholar.google.com,arxiv.org,pubmed.ncbi.nlm.nih.gov,nature.com,science.org,cell.com,pnas.org,nih.gov" \
  -o sources/research_crispr_advances-academic.json

parallel-cli search "Recent advances in CRISPR gene editing 2025" \
  -q "CRISPR" -q "gene editing" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  -o sources/research_crispr_advances-general.json

# Academic paper search via Perplexity. Save to sources/.
python research_lookup.py "Find papers on transformer attention mechanisms in NeurIPS 2024" \
  -o sources/papers_20250217_143500_transformer_attention.md

# Deep research via Parallel Chat API. Save to sources/.
python research_lookup.py "AI regulation landscape" --force-backend parallel \
  -o sources/research_20250217_144000_ai_regulation.md

# Batch queries. Save to sources/.
python research_lookup.py --batch "mRNA vaccines efficacy" "mRNA vaccines safety" \
  -o sources/batch_research_20250217_144500_mrna_vaccines.md
```

## Citation Preservation in Saved Files

Each output format preserves citations differently:

| Format | Citations Included | When to Use |
|--------|-------------------|-------------|
| parallel-cli JSON (default) | Full result objects: `title`, `url`, `publish_date`, `excerpts` | Standard use: structured, parseable, fast |
| Text (research_lookup.py) | `Sources (N):` section with `[title] (date) + URL` plus `Additional References (N):` with DOIs and academic URLs | Deep research / Perplexity: human-readable |
| JSON (`--json` via research_lookup.py) | Full citation objects: `url`, `title`, `date`, `snippet`, `doi`, `type` | When you need maximum citation metadata from deep research |

- For parallel-cli search, saved JSON files include full search results with title, URL, publish date, and content excerpts for each result.
- For Parallel Chat API backend, saved files include the research report plus Sources list (title, URL) plus Additional References (DOIs, academic URLs).
- For Perplexity backend, saved files include the academic summary plus Sources list (title, date, URL, snippet) plus Additional References (DOIs, academic URLs).

Use `--json` when you need to: parse citation metadata programmatically; preserve full DOI and URL data for BibTeX generation; maintain structured citation objects for cross-referencing.

## Why Save Everything

1. **Reproducibility**: every citation and claim can be traced back to its raw research source
2. **Context Window Recovery**: if context is compacted, saved results can be re-read without re-querying
3. **Audit Trail**: the `sources/` folder documents exactly how all research information was gathered
4. **Reuse Across Sections**: multiple sections can reference the same saved research without duplicate queries
5. **Cost Efficiency**: check `sources/` for existing results before making new API calls
6. **Peer Review Support**: reviewers can verify the research backing every citation

## Before Making a New Query, Check Sources First

Before calling `research_lookup.py`, check if a relevant result already exists:

```bash
ls sources/  # Check existing saved results
```

If a prior lookup covers the same topic, re-read the saved file instead of making a new API call.

## Logging

When saving research results, always log:

```
[HH:MM:SS] SAVED: Research lookup to sources/research_20250217_143000_crispr_advances.md (3,800 words, 8 citations)
[HH:MM:SS] SAVED: Paper search to sources/papers_20250217_143500_transformer_attention.md (6 papers found)
```
