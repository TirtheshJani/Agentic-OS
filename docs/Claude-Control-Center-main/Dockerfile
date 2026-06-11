# syntax=docker/dockerfile:1

# ── Stage 1: build the React frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
# Cache node_modules between builds; only reinstall when lock-file changes
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline

COPY frontend/ ./
RUN npm run build


# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Keeps Python from writing .pyc and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1 \
    PORT=5050 \
    CLAUDE_DIR=/data/claude \
    CODEX_DIR=/data/codex \
    CORS_ORIGIN=http://localhost:5050 \
    # GWS: use file-based keyring so the container doesn't need a D-Bus/keyring daemon
    GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file \
    GOOGLE_WORKSPACE_CLI_CONFIG_DIR=/data/gws-config \
    GWS_BINARY=/usr/local/bin/gws \
    GWS_SNAPSHOT_INTERVAL=900 \
    # Agentic OS — RAG foundation
    HF_HOME=/opt/hf_cache \
    SENTENCE_TRANSFORMERS_HOME=/opt/hf_cache \
    EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2 \
    LIGHTRAG_WORKING_DIR=/app/backend/data/lightrag \
    ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5-20251001 \
    MEMORY_DAILY_BUDGET_USD=5.00

WORKDIR /app

# Install Node.js (LTS) for the gws CLI, then install @googleworkspace/cli globally
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git && \
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g @googleworkspace/cli && \
    apt-get purge -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /root/.npm

# Install deps before copying app code so this layer is cached separately
COPY backend/requirements.txt /tmp/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r /tmp/requirements.txt gunicorn

# Pre-fetch the sentence-transformers embedding model so first request isn't
# blocked on a ~80 MB download. Cached at HF_HOME for the appuser to read.
RUN mkdir -p "$HF_HOME" && \
    python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL_NAME}')"

# Copy application code
COPY backend/ /app/backend/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Ensure GWS sandbox output dir + LightRAG working dir exist so volumes seed correctly
RUN mkdir -p /app/backend/data/gws_outputs /app/backend/data/lightrag

# Run as a non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app "$HF_HOME"
USER appuser

WORKDIR /app/backend
EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5050/api/health/scanners')" || exit 1

# 1 worker keeps memory low; 4 gthreads handles concurrent SSE connections
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5050", \
     "--worker-class", "gthread", \
     "--workers", "1", \
     "--threads", "4", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--log-level", "warning", \
     "run:app"]
