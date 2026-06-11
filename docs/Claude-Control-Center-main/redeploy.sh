#!/bin/bash
# Agentic OS (Claude Control Center) — rebuild and redeploy via Docker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
SERVICE="claude-control-center"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[redeploy]${RESET} $*"; }
success() { echo -e "${GREEN}[redeploy]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[redeploy]${RESET} $*"; }
error()   { echo -e "${RED}[redeploy]${RESET} $*" >&2; }

# Parse flags
TAIL_LOGS=false
NO_CACHE=false
for arg in "$@"; do
  case "$arg" in
    --logs|-l)      TAIL_LOGS=true ;;
    --no-cache|-n)  NO_CACHE=true ;;
    --help|-h)
      echo "Usage: $0 [--logs|-l] [--no-cache|-n]"
      echo "  -l, --logs      Tail container logs after deploy"
      echo "  -n, --no-cache  Force a full rebuild (no Docker layer cache)"
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

cd "$SCRIPT_DIR"

# Pre-flight: verify logo asset is present in the frontend public dir
LOGO_PATH="$SCRIPT_DIR/frontend/public/logo.png"
if [ ! -f "$LOGO_PATH" ]; then
  warn "Logo asset not found at frontend/public/logo.png"
  warn "The sidebar and browser tab will fall back to the default favicon until the logo is added."
else
  info "Logo asset present  →  frontend/public/logo.png"
fi

# Pre-flight: warn if gws credentials are missing (non-fatal)
GWS_CONFIG_DIR="${HOME}/.config/gws"
if [ ! -d "${GWS_CONFIG_DIR}" ] || [ -z "$(ls -A "${GWS_CONFIG_DIR}" 2>/dev/null)" ]; then
  warn "GWS credentials not found at ${GWS_CONFIG_DIR}"
  warn "The Workspace dashboard will show 'GWS unavailable' until you authenticate: gws gmail +triage"
else
  info "GWS credentials found at ${GWS_CONFIG_DIR}"
fi

# Pre-flight: check Gemini CLI data directory
GEMINI_DIR="${HOME}/.gemini"
if [ ! -d "${GEMINI_DIR}" ]; then
  warn "Gemini CLI directory not found at ${GEMINI_DIR}"
  warn "Install Gemini CLI (npm i -g @google/gemini-cli) and run 'gemini' once to initialise it"
else
  info "Gemini CLI directory found  →  ${GEMINI_DIR}"
fi

# Pre-flight: check permanent external storage mount
STORAGE_MOUNT="/media/storage"
if [ ! -d "${STORAGE_MOUNT}" ]; then
  warn "Permanent storage mount not found at ${STORAGE_MOUNT}"
  warn "Obsidian vaults and projects on the external drive won't be accessible in the container"
else
  info "External storage found  →  ${STORAGE_MOUNT} will be mounted read-write"
fi

# Pre-flight: check Antigravity CLI data directory
ANTIGRAVITY_DIR="${HOME}/.gemini/antigravity-cli"
if [ ! -d "${ANTIGRAVITY_DIR}" ]; then
  warn "Antigravity CLI directory not found at ${ANTIGRAVITY_DIR}"
  warn "Install and run Antigravity CLI to initialise it"
else
  info "Antigravity CLI directory found  →  ${ANTIGRAVITY_DIR}"
fi

# Pre-flight: check ~/Documents mount (required for GitHub repo root paths)
if [ ! -d "${HOME}/Documents" ]; then
  warn "~/Documents directory not found — repo root paths outside ~/.claude/.codex/.gemini won't be accessible"
else
  info "~/Documents will be mounted read-only at ${HOME}/Documents"
  info "Add any path under ~/Documents as a repo root in the GitHub → Settings tab"
  info "The same roots are used by Git Tree (/git-tree) for worktree management and commit graph"
fi

# Pre-flight: vault_pipeline — Research Pipeline → Vault Wiki Pipeline feature
CLAUDE_BIN="${HOME}/.local/bin/claude"
if [ ! -f "$CLAUDE_BIN" ]; then
  warn "claude CLI not found at ${CLAUDE_BIN}"
  warn "  Vault Wiki Pipeline (Research page) requires Claude Code CLI."
  warn "  Install: https://claude.ai/code  then re-run redeploy."
else
  info "claude CLI found  →  ${CLAUDE_BIN}"
fi

NOTEBOOKLM_BIN="${HOME}/.local/bin/notebooklm"
if [ ! -f "$NOTEBOOKLM_BIN" ]; then
  warn "notebooklm not found at ${NOTEBOOKLM_BIN}"
  warn "  Install: pip install notebooklm-py && notebooklm login"
else
  info "notebooklm found  →  ${NOTEBOOKLM_BIN}"
fi

YTDLP_BIN="${HOME}/.local/bin/yt-dlp"
if [ ! -f "$YTDLP_BIN" ]; then
  warn "yt-dlp not found at ${YTDLP_BIN} — vault_pipeline YouTube search will fail"
  warn "  Install: pip install yt-dlp"
else
  info "yt-dlp found  →  ${YTDLP_BIN}"
fi

# npm cache is mounted read-only for obsidian-cli (npx-cached at ~/.npm)
NPM_DIR="${HOME}/.npm"
if [ ! -d "$NPM_DIR" ]; then
  warn "~/.npm not found — obsidian-cli (vault_pipeline) may not resolve via npx"
  warn "  Run: npx obsidian-cli --help  once to seed the npx cache"
else
  info "~/.npm found  →  mounted for obsidian-cli npx cache"
fi

info "vault_pipeline: Obsidian must be running on the host with the"
info "  'Local REST API' community plugin enabled on port 27123."
info "  Container reaches it via host.docker.internal (extra_hosts in compose)."
info "  First time: Obsidian → Settings → Community plugins → search 'Local REST API'."

# Pre-flight: ~/.claude/agents — Agent View Dashboard
CLAUDE_AGENTS_DIR="${HOME}/.claude/agents"
if [ ! -d "$CLAUDE_AGENTS_DIR" ]; then
  warn "No agents directory found at ${CLAUDE_AGENTS_DIR}"
  warn "  Agent View Dashboard (/agent-view) will show an empty state."
  warn "  Create ~/.claude/agents/ and add .md agent definition files to populate it."
else
  AGENT_MD_COUNT=$(ls -1 "$CLAUDE_AGENTS_DIR"/*.md 2>/dev/null | wc -l | tr -d '[:space:]')
  info "~/.claude/agents found  →  ${AGENT_MD_COUNT} agent definition(s) available at /agent-view"
fi

# Pre-flight: /goal usage — Goal Monitor (/goals)
CLAUDE_PROJECTS_DIR="${HOME}/.claude/projects"
CODEX_SESSIONS_DIR="${HOME}/.codex/sessions"
GOAL_HITS=0
for goal_dir in "$CLAUDE_PROJECTS_DIR" "$CODEX_SESSIONS_DIR"; do
  if [ -d "$goal_dir" ]; then
    n=$(grep -rlF "command-name>/goal" "$goal_dir" 2>/dev/null || true | wc -l | tr -d '[:space:]')
    GOAL_HITS=$((GOAL_HITS + ${n:-0}))
  fi
done
if [ "${GOAL_HITS:-0}" -eq 0 ]; then
  info "No /goal commands found in sessions yet — Goal Monitor (/goals) will show an empty state."
  info "  Run '/goal <your objective>' in Claude Code or Codex to populate it."
else
  info "Goal Monitor: /goal usage detected in ${GOAL_HITS} session file(s)  →  available at /goals"
fi

# Pre-flight: ANTHROPIC_API_KEY — Gateway Models tab + Memory RAG + Eval LLM judge
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  # Check .env as fallback
  ENV_FILE="$SCRIPT_DIR/backend/.env"
  if [ -f "$ENV_FILE" ] && grep -q "ANTHROPIC_API_KEY" "$ENV_FILE" 2>/dev/null; then
    info "ANTHROPIC_API_KEY found in backend/.env  →  Gateway Models, Memory RAG, and Eval LLM judge enabled"
  else
    warn "ANTHROPIC_API_KEY not set in environment or backend/.env"
    warn "  Settings → Gateway tab (model list), Memory RAG, and Eval LLM judge will be unavailable."
    warn "  Add ANTHROPIC_API_KEY=sk-ant-... to backend/.env to enable these features."
  fi
else
  info "ANTHROPIC_API_KEY set in environment  →  Gateway Models, Memory RAG, and Eval LLM judge enabled"
fi

# Pre-flight: Eval system budget (optional — defaults to $2/day if unset)
ENV_FILE="$SCRIPT_DIR/backend/.env"
if [ -f "$ENV_FILE" ] && grep -q "EVAL_DAILY_BUDGET_USD" "$ENV_FILE" 2>/dev/null; then
  EVAL_BUDGET=$(grep "EVAL_DAILY_BUDGET_USD" "$ENV_FILE" | cut -d'=' -f2 | tr -d '[:space:]')
  info "Eval LLM judge budget  →  \$${EVAL_BUDGET} / UTC day (from backend/.env)"
else
  info "Eval LLM judge budget  →  \$2.00 / UTC day (default; set EVAL_DAILY_BUDGET_USD in backend/.env to change)"
fi

# Pre-flight: Invoicing — private Google Sheet id (Sheet → BMO bookkeeper feature)
ENV_FILE="$SCRIPT_DIR/backend/.env"
if [ -f "$ENV_FILE" ] && grep -q "^INVOICING_SHEET_ID=" "$ENV_FILE" 2>/dev/null; then
  info "Invoicing sheet id found in backend/.env  →  loaded into the container via env_file"
else
  warn "INVOICING_SHEET_ID not set in backend/.env"
  warn "  The Invoicing page (/invoicing) will start with a blank spreadsheet field."
  warn "  Add INVOICING_SHEET_ID=<sheet id> to backend/.env to prefill it."
fi

# Pre-flight: News & Information hub (/news) — manual-refresh aggregator
ENV_FILE="$SCRIPT_DIR/backend/.env"
NEWS_X_OK=false; NEWS_REDDIT_OK=false
if [ -f "$ENV_FILE" ] && grep -q "^FIRECRAWL_API_KEY=." "$ENV_FILE" 2>/dev/null; then NEWS_X_OK=true; fi
if [ -f "$ENV_FILE" ] && grep -q "^REDDIT_CLIENT_ID=." "$ENV_FILE" 2>/dev/null; then NEWS_REDDIT_OK=true; fi
info "News hub (/news): tech-news RSS streams work out of the box (no key needed)."
$NEWS_X_OK   && info "  FIRECRAWL_API_KEY set  →  @ClaudeDevs X stream enabled." \
             || warn "  FIRECRAWL_API_KEY not set  →  the X (@ClaudeDevs) stream will be empty."
$NEWS_REDDIT_OK && info "  Reddit creds set  →  community stream enabled." \
                || warn "  REDDIT_CLIENT_ID/SECRET not set  →  the Reddit stream will be empty."
info "  Video/learning idea generation reuses ANTHROPIC_API_KEY (checked above)."

# Pre-flight: MCP tool count cache
MCP_CACHE="$SCRIPT_DIR/backend/data/mcp_tool_counts.json"
if [ ! -f "$MCP_CACHE" ]; then
  info "MCP tool count cache not yet built — hit 'Refresh Tool Counts' in MCP Servers page to populate it"
else
  info "MCP tool count cache found  →  ${MCP_CACHE}"
fi

# Info: named volume ccc-data persists recipes, audit logs, and GWS cache across rebuilds
if docker volume inspect ccc-data >/dev/null 2>&1; then
  info "Reusing existing ccc-data volume (agent library, recipes, audit logs preserved)"
  info "Run 'docker compose down -v' first if you want a clean data reset"
else
  info "ccc-data volume will be created on first start (agent library + image defaults seeded)"
fi

info "Rebuilding and redeploying $SERVICE ..."

BUILD_ARGS="--build"
if $NO_CACHE; then
  info "Cache disabled — full rebuild in progress"
  docker compose -f "$COMPOSE_FILE" build --no-cache
  BUILD_ARGS=""   # image already built above
fi

# Rebuild image and restart container (no downtime window beyond container restart)
docker compose -f "$COMPOSE_FILE" up -d $BUILD_ARGS

# Wait for the container to be running
info "Waiting for container to become healthy ..."
TIMEOUT=30
ELAPSED=0
until docker inspect --format='{{.State.Status}}' "$SERVICE" 2>/dev/null | grep -q "running"; do
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    error "Container did not start within ${TIMEOUT}s."
    docker compose -f "$COMPOSE_FILE" logs --tail=30 "$SERVICE"
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

success "Container is running  →  http://localhost:5050"
info    "Default route: /dashboard (Command Center)"
info    "Theme persisted in localStorage key 'aos:theme' — light/dark/system"
info    "CLI providers unified under /api/cli/<provider> (claude, codex-cli, gemini, antigravity)"
info    "  Legacy /api/{codex-cli,gemini,antigravity}/* endpoints remain as aliases for one release"

# Seed agent library into the persistent volume if it has no entries yet.
# The ccc-data volume shadows /app/backend/data, so agents baked into the
# image are invisible when an existing volume is mounted. Copy them once.
AGENT_SRC="$SCRIPT_DIR/backend/data/agent_library"
if [ -d "$AGENT_SRC" ] && [ -n "$(ls -A "$AGENT_SRC"/*.json 2>/dev/null)" ]; then
  AGENT_COUNT=$(docker exec "$SERVICE" sh -c \
    'ls /app/backend/data/agent_library/*.json 2>/dev/null | wc -l || echo 0' 2>/dev/null | tr -d '[:space:]')
  if [ "${AGENT_COUNT:-0}" -eq 0 ]; then
    info "Seeding agent library into persistent volume ..."
    docker exec "$SERVICE" mkdir -p /app/backend/data/agent_library
    docker cp "$AGENT_SRC/." "$SERVICE:/app/backend/data/agent_library/"
    SEEDED=$(ls "$AGENT_SRC"/*.json 2>/dev/null | wc -l | tr -d '[:space:]')
    success "Agent library seeded  →  ${SEEDED} agents available at /agent-library"
  else
    info "Agent library already present in volume  (${AGENT_COUNT} agents)"
  fi
fi

if $TAIL_LOGS; then
  info "Tailing logs (Ctrl+C to stop) ..."
  docker compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
fi
