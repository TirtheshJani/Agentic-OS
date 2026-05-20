# Technical Integration

## Prerequisites

```bash
# Primary backend (parallel-cli): REQUIRED
# Install parallel-cli if not already available
curl -fsSL https://parallel.ai/install.sh | bash
# Or: uv tool install "parallel-web-tools[cli]"

# Authenticate
parallel-cli auth
# Or: export PARALLEL_API_KEY="your_parallel_api_key"
```

## Environment Variables

```bash
# Primary backend (parallel-cli search): REQUIRED
export PARALLEL_API_KEY="your_parallel_api_key"

# Deep research backend (Parallel Chat API): optional, uses the same PARALLEL_API_KEY

# Academic search backend (Perplexity): optional, for academic paper queries
export OPENROUTER_API_KEY="your_openrouter_api_key"
```

## API Specifications

### parallel-cli search (PRIMARY)
- Command: `parallel-cli search` with `--json` output
- Latency: 2-10 seconds (fast)
- Output: JSON with title, URL, publish_date, excerpts
- Academic domains: use `--include-domains` for scholarly sources
- Saves results: `-o filename.json` for follow-up and reproducibility

### Parallel Chat API (deep research only)
- Endpoint: `https://api.parallel.ai` (OpenAI SDK compatible)
- Model: `core` (60s to 5min latency, complex multi-source synthesis)
- Output: Markdown text with inline citations
- Citations: research basis with URLs, reasoning, and confidence levels
- Rate limits: 300 req/min
- Python package: `openai`

### Perplexity sonar-pro-search (academic only)
- Model: `perplexity/sonar-pro-search` (via OpenRouter)
- Search mode: Academic (prioritizes peer-reviewed sources)
- Search context: High (comprehensive research)
- Response time: 5-15 seconds

## Command-Line Usage

```bash
# Fast web search via parallel-cli (DEFAULT, recommended). ALWAYS save to sources/.
parallel-cli search "your query" -q "keyword1" -q "keyword2" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  -o sources/research_<topic>.json

# Academic-focused search via parallel-cli. ALWAYS save to sources/.
parallel-cli search "your query" -q "keyword1" \
  --json --max-results 10 --excerpt-max-chars-total 27000 \
  --include-domains "scholar.google.com,arxiv.org,pubmed.ncbi.nlm.nih.gov,semanticscholar.org,biorxiv.org,medrxiv.org,nature.com,science.org,cell.com,pnas.org,nih.gov" \
  -o sources/research_<topic>-academic.json

# Time-sensitive search via parallel-cli
parallel-cli search "your query" -q "keyword" \
  --json --max-results 10 --after-date 2024-01-01 \
  -o sources/research_<topic>.json

# Extract full content from a specific URL (use parallel-web extract)
parallel-cli extract "https://example.com/paper" --json

# Force Parallel Deep Research (slow, exhaustive) via research_lookup.py
python research_lookup.py "your query" --force-backend parallel -o sources/research_<topic>.md

# Force Perplexity academic search via research_lookup.py
python research_lookup.py "your query" --force-backend perplexity -o sources/papers_<topic>.md

# Auto-routed via research_lookup.py (legacy). ALWAYS save to sources/.
python research_lookup.py "your query" -o sources/research_YYYYMMDD_HHMMSS_<topic>.md

# Batch queries via research_lookup.py. ALWAYS save to sources/.
python research_lookup.py --batch "query 1" "query 2" "query 3" -o sources/batch_research_<topic>.md
```
