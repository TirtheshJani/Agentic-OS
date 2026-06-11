import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

CLAUDE_DIR = Path(os.getenv("CLAUDE_DIR", Path.home() / ".claude"))
CODEX_DIR = Path(os.getenv("CODEX_DIR", Path.home() / ".codex"))
PORT = int(os.getenv("PORT", 5050))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

# Background scanner control. Accepts:
#   "" / unset       -> all scanners run (default)
#   "1" / "all"      -> disable every background scanner
#   "a,b,c"          -> disable the named scanners (comma-separated)
# Useful for tests, CI, and debugging without filesystem side effects.
CCC_DISABLE_SCANNERS = os.getenv("CCC_DISABLE_SCANNERS", "").strip()

# Managed Agents API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MANAGED_AGENTS_BASE_URL = os.getenv("MANAGED_AGENTS_BASE_URL", "https://api.anthropic.com")

# Model A/B Bench — optional non-Anthropic providers. Each is only invoked when
# its key is configured; an absent key means that provider is skipped silently.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
# Hard cap on real API spend per UTC day for bench runs. On exhaustion the
# /api/bench/run route rejects new runs with a 429 until the next UTC day.
BENCH_DAILY_BUDGET_USD = float(os.getenv("BENCH_DAILY_BUDGET_USD", "3.00"))

# Google Workspace CLI
GWS_BINARY = os.getenv("GWS_BINARY", "")  # optional; fallback chain used if empty
GWS_SNAPSHOT_INTERVAL = int(os.getenv("GWS_SNAPSHOT_INTERVAL", 900))

# Agentic OS — Phase 1 (RAG foundation)
# Storage dir for LightRAG (knowledge graph + vector stores). Lives on the ccc-data volume.
LIGHTRAG_WORKING_DIR = Path(
    os.getenv("LIGHTRAG_WORKING_DIR", Path(__file__).parent.parent / "data" / "lightrag")
)
# Anthropic model used for LightRAG's entity/relationship extraction.
ANTHROPIC_HAIKU_MODEL = os.getenv("ANTHROPIC_HAIKU_MODEL", "claude-haiku-4-5-20251001")
# Hard cap on Haiku spend per UTC day for RAG operations. On exhaustion the service
# rejects new insert/extract calls and reports budget_exhausted via /status.
MEMORY_DAILY_BUDGET_USD = float(os.getenv("MEMORY_DAILY_BUDGET_USD", "5.00"))
# Local embedding model loaded via sentence-transformers. 384-dim, ~80 MB.
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))

# Invoicing — Google Sheet → BMO bookkeeper integration.
# The bookkeeper Flask app runs on the host (~/Documents/bmo-bookkeeper, :5223).
# From inside the CCC container, reach it via the host gateway (extra_hosts).
BOOKKEEPER_BASE_URL = os.getenv("BOOKKEEPER_BASE_URL", "http://host.docker.internal:5223")
# Default spreadsheet id prefilled in the Invoicing UI (one tab per invoice).
INVOICING_SHEET_ID = os.getenv("INVOICING_SHEET_ID", "")

# CRM — Google Sheet backed client spine (Clients + Deals tabs).
# Create one via POST /api/crm/setup, then persist the id here.
CRM_SHEET_ID = os.getenv("CRM_SHEET_ID", "")

# Agentic OS — Phase 1 (Gemini CLI integration)
GEMINI_DIR = Path(os.getenv("GEMINI_DIR", Path.home() / ".gemini"))

# Agentic OS - Antigravity
ANTIGRAVITY_DIR = Path(os.getenv("ANTIGRAVITY_DIR", Path.home() / ".gemini" / "antigravity-cli"))

# Agentic OS — Phase 1 (MCP memory server)
# Absolute host path to the compiled MCP memory server entry point.
MCP_MEMORY_SERVER_PATH = os.getenv("MCP_MEMORY_SERVER_PATH", "")
CCC_BASE_URL = os.getenv("CCC_BASE_URL", "http://127.0.0.1:5050")

# External LightRAG server (running separately on the host).
# All RAG insert/query calls are proxied to this service.
LIGHTRAG_SERVER_URL = os.getenv("LIGHTRAG_SERVER_URL", "http://localhost:9621")
# Max documents auto-ingested per UTC day across all session sources.
LIGHTRAG_DAILY_INGEST_LIMIT = int(os.getenv("LIGHTRAG_DAILY_INGEST_LIMIT", "200"))
# How often (seconds) the session ingest scanner polls for new content.
LIGHTRAG_INGEST_INTERVAL = int(os.getenv("LIGHTRAG_INGEST_INTERVAL", "300"))

# Agentic OS — Phase 2 (Obsidian vault integration)
# JSON config file storing user-configured vault paths.
OBSIDIAN_VAULTS_CONFIG = Path(
    os.getenv("OBSIDIAN_VAULTS_CONFIG", Path(__file__).parent.parent / "data" / "obsidian_vaults.json")
)

# Agentic OS — Phase 3 (Research pipeline)
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "ccc-research-bot/1.0")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

# News & Information hub — aggregates X (@ClaudeDevs), tech news, Reddit + LLM idea generation.
# Manual-refresh only; no background daemon.
NEWS_X_HANDLE = os.getenv("NEWS_X_HANDLE", "ClaudeDevs")
# Firecrawl target for the X feed. x.com is login-gated, so default to a nitter mirror.
NEWS_X_SCRAPE_URL = os.getenv("NEWS_X_SCRAPE_URL", "https://nitter.net/ClaudeDevs")
NEWS_SUBREDDITS = [
    s.strip()
    for s in os.getenv(
        "NEWS_SUBREDDITS", "ClaudeAI,LocalLLaMA,MachineLearning,ChatGPT,singularity"
    ).split(",")
    if s.strip()
]
# User-editable list of RSS/blog/news feed URLs (seeded with defaults on first run).
NEWS_FEEDS_CONFIG = Path(
    os.getenv("NEWS_FEEDS_CONFIG", Path(__file__).parent.parent / "data" / "news_feeds_config.json")
)
# Model used to turn the feed into video / learning-content ideas.
NEWS_IDEA_MODEL = os.getenv("NEWS_IDEA_MODEL", ANTHROPIC_HAIKU_MODEL)

# Agentic OS — Phase 4 (GitHub / Git integration)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_API_BASE = os.getenv("GITHUB_API_BASE", "https://api.github.com")
GITHUB_SNAPSHOT_INTERVAL = int(os.getenv("GITHUB_SNAPSHOT_INTERVAL", 600))
GITHUB_REPOS_CONFIG = Path(
    os.getenv("GITHUB_REPOS_CONFIG", Path(__file__).parent.parent / "data" / "github_repos_config.json")
)
