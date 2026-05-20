---
name: research-lookup
description: Look up current research information using parallel-cli search (primary, fast web search), the Parallel Chat API (deep research), or Perplexity sonar-pro-search (academic paper searches). Automatically routes queries to the best backend. Use for finding papers, gathering research data, and verifying scientific information.
allowed-tools: Read Write Edit Bash
license: MIT
metadata:
  status: authored
  domain: research
  mode: local
  mcp-server: none
  external-apis: []
  outputs: []
  skill-author: K-Dense Inc.
  compatibility: parallel-cli required (primary); PARALLEL_API_KEY and OPENROUTER_API_KEY optional for deep/academic backends
---

# Research Information Lookup

## Overview

This skill provides real-time research information lookup with **intelligent backend routing**:

- **parallel-cli search** (parallel-web skill): **Primary and default backend** for all research queries. Fast, cost-effective web search with academic source prioritization. Uses `parallel-cli search` with `--include-domains` for scholarly sources.
- **Parallel Chat API** (`core` model): Secondary backend for complex, multi-source deep research requiring extended synthesis (60s-5min latency). Use only when explicitly needed.
- **Perplexity sonar-pro-search** (via OpenRouter): Used only for academic-specific paper searches where scholarly database access is critical.

The skill automatically detects query type and routes to the optimal backend.

## When to Use This Skill

Use this skill when you need:

- **Current Research Information**: Latest studies, papers, and findings
- **Literature Verification**: Check facts, statistics, or claims against current research
- **Background Research**: Gather context and supporting evidence for scientific writing
- **Citation Sources**: Find relevant papers and studies to cite
- **Technical Documentation**: Look up specifications, protocols, or methodologies
- **Market/Industry Data**: Current statistics, trends, competitive intelligence
- **Recent Developments**: Emerging trends, breakthroughs, announcements

### When to use vs other research skills

This is the lead skill for ad-hoc research lookups. Pick a different skill when the task is more structured:

- [paper-search](../paper-search/SKILL.md): when you need a single paper by DOI/OpenAlex ID, or a quick keyword query against OpenAlex (250M+ works, no API key).
- [literature-review](../literature-review/SKILL.md): when you need a full systematic review across multiple databases with PRISMA-style screening, citation verification, and a markdown/PDF deliverable.
- [deep-web-research](../deep-web-research/SKILL.md): when you need an extended deep-research session on a single topic that writes to `vault/wiki/research/general/`.
- [morning-trend-scan](../morning-trend-scan/SKILL.md): when you want a recurring digest of GitHub trending plus arXiv to a daily note. Scheduled, not on-demand.

Use `research-lookup` (this skill) for everything else: fast single-query fact-finding, citation hunting, background context, and verification.

## Visual Enhancement

<!-- TODO: vendor scientific-schematics skill -->

When creating documents with this skill, consider adding scientific diagrams and schematics to enhance visual communication. Until a companion schematic-generation skill is vendored into this repo, draft figure intent during planning and produce figures manually.

---

## Automatic Backend Selection

The skill automatically routes queries to the best backend based on content:

### Routing Logic

```
Query arrives
    |
    +-- Contains academic keywords? (papers, DOI, journal, peer-reviewed, etc.)
    |       YES --> Perplexity sonar-pro-search (academic search mode)
    |
    +-- Needs deep multi-source synthesis? (user says "deep research", "exhaustive")
    |       YES --> Parallel Chat API (core model, 60s-5min)
    |
    +-- Everything else (general research, market data, technical info, analysis)
            --> parallel-cli search (fast, default)
```

### Default: parallel-cli search (parallel-web skill)

**Primary backend for all standard research queries.** Fast, cost-effective, and supports academic source prioritization.

For scientific/technical queries, run two searches to ensure academic coverage:

```bash
# 1. Academic-focused search
parallel-cli search "your research query" -q "keyword1" -q "keyword2" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --include-domains "scholar.google.com,arxiv.org,pubmed.ncbi.nlm.nih.gov,semanticscholar.org,biorxiv.org,medrxiv.org,ncbi.nlm.nih.gov,nature.com,science.org,ieee.org,acm.org,springer.com,wiley.com,cell.com,pnas.org,nih.gov" \
  -o sources/research_<topic>-academic.json

# 2. General search (catches non-academic sources)
parallel-cli search "your research query" -q "keyword1" -q "keyword2" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  -o sources/research_<topic>-general.json
```

Options:
- `--after-date YYYY-MM-DD` for time-sensitive queries
- `--include-domains domain1.com,domain2.com` to limit to specific sources

Merge results, leading with academic sources. For non-scientific queries, a single general search is sufficient.

All other queries route here by default, including:

- General research questions
- Market and industry analysis
- Technical information and documentation
- Current events and recent developments
- Comparative analysis
- Statistical data retrieval
- Fact-checking and verification

### Academic Keywords (Routes to Perplexity)

Queries containing these terms are routed to Perplexity for academic-focused search:

- Paper finding: `find papers`, `find articles`, `research papers on`, `published studies`
- Citations: `cite`, `citation`, `doi`, `pubmed`, `pmid`
- Academic sources: `peer-reviewed`, `journal article`, `scholarly`, `arxiv`, `preprint`
- Review types: `systematic review`, `meta-analysis`, `literature search`
- Paper quality: `foundational papers`, `seminal papers`, `landmark papers`, `highly cited`

### Deep Research (Routes to Parallel Chat API)

Only used when the user explicitly requests deep, exhaustive, or comprehensive research. Much slower and more expensive than parallel-cli search.

### Manual Override

You can force a specific backend:

```bash
# Force parallel-cli search (fast web search)
parallel-cli search "your query" -q "keyword" --json --max-results 10 -o sources/research_<topic>.json

# Force Parallel Deep Research (slow, exhaustive)
python research_lookup.py "your query" --force-backend parallel

# Force Perplexity academic search
python research_lookup.py "your query" --force-backend perplexity
```

---

## Core Capabilities

### 1. General Research Queries (parallel-cli search, DEFAULT)

**Primary backend.** Fast, cost-effective web search with academic source prioritization via the parallel-web skill.

```
Query Examples:
- "Recent advances in CRISPR gene editing 2025"
- "Compare mRNA vaccines vs traditional vaccines for cancer treatment"
- "AI adoption in healthcare industry statistics"
- "Global renewable energy market trends and projections"
- "Explain the mechanism underlying gut microbiome and depression"
```

```bash
# Example: research on CRISPR advances
parallel-cli search "Recent advances in CRISPR gene editing 2025" \
  -q "CRISPR" -q "gene editing" -q "2025" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --include-domains "scholar.google.com,arxiv.org,pubmed.ncbi.nlm.nih.gov,nature.com,science.org,cell.com,pnas.org,nih.gov" \
  -o sources/research_crispr_advances-academic.json

parallel-cli search "Recent advances in CRISPR gene editing 2025" \
  -q "CRISPR" -q "gene editing" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  -o sources/research_crispr_advances-general.json
```

**Response includes:**
- Synthesized findings with inline citations from search results
- Academic sources prioritized (peer-reviewed, preprints)
- Specific facts, numbers, and dates
- Sources section listing all referenced URLs grouped by type

### 2. Academic Paper Search (Perplexity sonar-pro-search)

**Used for academic-specific queries.** Prioritizes scholarly databases and peer-reviewed sources. Use when queries specifically ask for papers, citations, or DOIs.

```
Query Examples:
- "Find papers on transformer attention mechanisms in NeurIPS 2024"
- "Foundational papers on quantum error correction"
- "Systematic review of immunotherapy in non-small cell lung cancer"
- "Cite the original BERT paper and its most influential follow-ups"
- "Published studies on CRISPR off-target effects in clinical trials"
```

**Response includes:**
- Summary of key findings from academic literature
- 5-8 high-quality citations with authors, titles, journals, years, DOIs
- Citation counts and venue tier indicators
- Key statistics and methodology highlights
- Research gaps and future directions

### 3. Deep Research (Parallel Chat API, on request only)

**Used only when user explicitly requests deep/exhaustive research.** Provides comprehensive, multi-source synthesis via the Chat API (`core` model). 60s-5min latency.

```
Query Examples:
- "Deep research on the current state of quantum computing error correction"
- "Exhaustive analysis of mRNA vaccine platforms for cancer immunotherapy"
```

### 4. Technical and Methodological Information

Use parallel-cli search (default) for quick lookups:

```bash
parallel-cli search "Western blot protocol for protein detection" \
  -q "western blot" -q "protocol" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  -o sources/research_western_blot.json
```

### 5. Statistical and Market Data

Use parallel-cli search (default) for current data:

```bash
parallel-cli search "Global AI market size and growth projections 2025" \
  -q "AI market" -q "statistics" -q "growth" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --after-date 2024-01-01 \
  -o sources/research_ai_market.json
```

---

## Paper Quality and Popularity Prioritization

**CRITICAL**: When searching for papers, ALWAYS prioritize high-quality, influential papers.

### Citation-Based Ranking

| Paper Age | Citation Threshold | Classification |
|-----------|-------------------|----------------|
| 0-3 years | 20+ citations | Noteworthy |
| 0-3 years | 100+ citations | Highly Influential |
| 3-7 years | 100+ citations | Significant |
| 3-7 years | 500+ citations | Landmark Paper |
| 7+ years | 500+ citations | Seminal Work |
| 7+ years | 1000+ citations | Foundational |

### Venue Quality Tiers

**Tier 1 - Premier Venues** (Always prefer):
- **General Science**: Nature, Science, Cell, PNAS
- **Medicine**: NEJM, Lancet, JAMA, BMJ
- **Field-Specific**: Nature Medicine, Nature Biotechnology, Nature Methods
- **Top CS/AI**: NeurIPS, ICML, ICLR, ACL, CVPR

**Tier 2 - High-Impact Specialized** (Strong preference):
- Journals with Impact Factor > 10
- Top conferences in subfields (EMNLP, NAACL, ECCV, MICCAI)

**Tier 3 - Respected Specialized** (Include when relevant):
- Journals with Impact Factor 5-10

---

## Technical Integration

See [references/technical_integration.md](references/technical_integration.md) for full prerequisites, environment variable setup, per-backend API specifications (parallel-cli search, Parallel Chat API, Perplexity sonar-pro-search), and the complete command-line usage reference covering default search, academic search, time-sensitive search, URL extraction, deep research, batch queries, and forced-backend invocations.

---

## MANDATORY: Save All Results to Sources Folder

Every research-lookup result MUST be saved to the project's `sources/` folder using the `-o` flag. This is non-negotiable: results are expensive to obtain and critical for reproducibility. Before making a new query, always `ls sources/` to check for an existing relevant result.

See [references/sources_folder_policy.md](references/sources_folder_policy.md) for the full filename-pattern table per backend, citation-preservation guarantees per output format, the rationale (reproducibility, context-window recovery, audit trail, reuse, cost, peer review), and the standard logging format.

---

## Integration with Scientific Writing

This skill enhances scientific writing by providing:

1. **Literature Review Support**: gather current research for introduction and discussion. Save to `sources/`.
2. **Methods Validation**: verify protocols against current standards. Save to `sources/`.
3. **Results Contextualization**: compare findings with recent similar studies. Save to `sources/`.
4. **Discussion Enhancement**: support arguments with latest evidence. Save to `sources/`.
5. **Citation Management**: provide properly formatted citations. Save to `sources/`.

## Complementary Tools

| Task | Tool |
|------|------|
| General web search (fast) | `parallel-cli search` (built into this skill) |
| Academic-focused web search | `parallel-cli search --include-domains` (built into this skill) |
| URL content extraction | `parallel-cli extract` (parallel-web skill) |
| Deep research (exhaustive) | `research-lookup` via Parallel Chat API or `parallel-web` deep research |
| Academic paper search | `research-lookup` (auto-routes to Perplexity) |
| Google Scholar search | `citation-management` skill |
| PubMed search | `citation-management` skill |
| DOI to BibTeX | `citation-management` skill |
| Metadata verification | `parallel-cli extract` (parallel-web skill) |

---

## Error Handling and Limitations

**Known Limitations:**
- parallel-cli search: Requires `parallel-cli` to be installed and authenticated
- Parallel Chat API (core model): Complex queries may take up to 5 minutes
- Perplexity: Information cutoff, may not access full text behind paywalls
- All backends: Cannot access proprietary or restricted databases

**Fallback Behavior:**
- If `parallel-cli` is not found, install with `curl -fsSL https://parallel.ai/install.sh | bash` or `uv tool install "parallel-web-tools[cli]"`
- If parallel-cli search returns insufficient results, fall back to Perplexity or Parallel Chat API
- If the selected backend's API key is missing, tries the other backend
- If all backends fail, returns structured error response
- Rephrase queries for better results if initial response is insufficient

---

## Usage Examples

### Example 1: General Research (Routes to parallel-cli search)

**Query**: "Recent advances in transformer attention mechanisms 2025"

**Backend**: parallel-cli search (default, fast)

**Commands**:
```bash
parallel-cli search "Recent advances in transformer attention mechanisms 2025" \
  -q "transformer" -q "attention" -q "2025" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --include-domains "arxiv.org,semanticscholar.org,nature.com,science.org,ieee.org,acm.org" \
  -o sources/research_transformer_attention-academic.json

parallel-cli search "Recent advances in transformer attention mechanisms 2025" \
  -q "transformer" -q "attention" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  -o sources/research_transformer_attention-general.json
```

**Response**: Synthesized findings with inline citations from academic and general sources, covering recent papers, key innovations, and performance benchmarks.

### Example 2: Academic Paper Search (Routes to Perplexity)

**Query**: "Find papers on CRISPR off-target effects in clinical trials"

**Backend**: Perplexity sonar-pro-search (academic mode)

**Response**: Curated list of 5-8 high-impact papers with full citations, DOIs, citation counts, and venue tier indicators.

### Example 3: Comparative Analysis (Routes to parallel-cli search)

**Query**: "Compare and contrast mRNA vaccines vs traditional vaccines for cancer treatment"

**Backend**: parallel-cli search (default, fast)

**Response**: Synthesized comparison from multiple web sources with inline citations, structured analysis, and evidence quality notes.

### Example 4: Market Data (Routes to parallel-cli search)

**Query**: "Global AI adoption in healthcare statistics 2025"

**Backend**: parallel-cli search (default, fast)

```bash
parallel-cli search "Global AI adoption in healthcare statistics 2025" \
  -q "AI healthcare" -q "adoption statistics" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --after-date 2024-01-01 \
  -o sources/research_ai_healthcare_adoption.json
```

**Response**: Current market data, adoption rates, growth projections, and regional analysis with source citations.

---

## Summary

This skill serves as the primary research interface with intelligent tri-backend routing:

- **parallel-cli search** (default): Fast, cost-effective web search with academic source prioritization via the parallel-web skill
- **Parallel Chat API** (`core` model): Deep, exhaustive multi-source synthesis (on explicit request only)
- **Perplexity sonar-pro-search**: Academic-specific paper searches only
- **Automatic routing**: Detects query type and routes to the optimal backend
- **Manual override**: Force any backend when needed
- **Academic prioritization**: Two-search pattern ensures scholarly sources surface for scientific queries
