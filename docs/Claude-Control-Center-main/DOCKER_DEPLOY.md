# Docker Deployment Guide — Claude Control Center

## Prerequisites

| Requirement | Minimum version |
|---|---|
| Docker Engine | 24.x |
| Docker Compose plugin | v2.20+ |
| BuildKit | enabled by default in Docker 23+ |
| Disk space | ~400 MB (image + build cache) |

> **BuildKit** is required for the `--mount=type=cache` build optimisations.
> It is enabled by default on Docker Desktop and Docker Engine ≥ 23.
> If you are on an older engine, prefix your build command with `DOCKER_BUILDKIT=1`.

---

## Quick Start

```bash
# 1. Clone / enter the project directory
cd "Claude Control Center"

# 2. Build and start (detached)
docker compose up -d --build

# 3. Open the UI
open http://localhost:5050
```

---

## Build

```bash
# First build (downloads base images + installs deps)
docker compose build

# Subsequent builds (cached layers; only changed stages rebuild)
docker compose build --no-cache   # force full rebuild
```

The Dockerfile uses two **BuildKit cache mounts**:

| Cache | What it speeds up |
|---|---|
| `/root/.npm` | `npm ci` — skips re-downloading packages when only app code changes |
| `/root/.cache/pip` | `pip install` — skips re-downloading wheels |

After the first build, incremental rebuilds typically complete in **< 30 s** when only Python or frontend source files change.

---

## Runtime Operations

| Task | Command |
|---|---|
| Start in background | `docker compose up -d` |
| Rebuild and restart | `docker compose up -d --build` |
| Stop | `docker compose down` |
| View logs (live) | `docker compose logs -f` |
| Check health | `docker compose ps` |
| Resource usage | `docker stats claude-control-center` |
| Open a shell | `docker compose exec claude-control-center sh` |

---

## Resource Usage

### Measured at idle (single user, no active scans)

| Resource | Typical idle | Peak (initial scan) |
|---|---|---|
| RAM | ~100–130 MB | ~160 MB |
| CPU | < 0.02 cores | ~0.3 cores |
| Disk (image) | ~220 MB | — |
| Network | < 1 KB/s | — |

### Enforced limits (set in `docker-compose.yml`)

| Limit | Value | Notes |
|---|---|---|
| CPU cap | 0.50 cores | Prevents runaway scans from impacting the host |
| Memory hard limit | 256 MB | Container is OOM-killed if exceeded |
| Memory reservation | 64 MB | Guaranteed scheduling headroom |

> The gunicorn server runs **1 worker + 4 gthreads**.
> This is intentionally lean for a personal dashboard:
> - 1 worker eliminates redundant process overhead (~30 MB per extra worker)
> - 4 threads is enough to serve the UI and handle concurrent SSE connections
> - Raise `--workers` to `2` in the Dockerfile `CMD` only if you serve multiple users

### Log rotation

Logs are automatically rotated:

- **10 MB** per file
- **3 files** kept → maximum **30 MB** on disk

---

## Data Volume

Your `~/.claude` directory is mounted **read-write** into the container at `/data/claude`.
Your `~/.codex` directory is mounted into the container at `/data/codex` so Codex sessions, settings, skills, and memory can be scanned.

```yaml
volumes:
  - ${HOME}/.claude:/data/claude
  - ${HOME}/.codex:/data/codex
```

The app writes memory files (`~/.claude/projects/*/memory/`) back to the Claude directory. No persistent named volume is needed; all source data lives directly in your host `~/.claude` and `~/.codex` directories.

---

## Network

The port is bound to `127.0.0.1` by default:

```
ports:
  - "127.0.0.1:5050:5050"
```

This means the UI is only reachable from the **local machine**.
To expose it on your LAN, change it to:

```yaml
ports:
  - "5050:5050"
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5050` | Port gunicorn listens on inside the container |
| `CLAUDE_DIR` | `/data/claude` | Path to the Claude data directory inside the container |
| `CODEX_DIR` | `/data/codex` | Path to the Codex data directory inside the container |
| `CORS_ORIGIN` | `http://localhost:5050` | Allowed CORS origin for the Flask API |

Override any variable in `docker-compose.yml` under the `environment:` key.

---

## Troubleshooting

**Container exits immediately**
```bash
docker compose logs claude-control-center
```
Check that `${HOME}/.claude` exists on the host.
If Codex pages are empty, also check that `${HOME}/.codex` exists and is mounted.

**`permission denied` on the volume**
The container runs as a non-root user (`appuser`). If your `~/.claude` directory has restrictive permissions, add yourself to the docker group or adjust directory permissions:
```bash
chmod o+r ~/.claude
```

**Port already in use**
Change the host-side port in `docker-compose.yml`:
```yaml
ports:
  - "127.0.0.1:5051:5050"   # use 5051 on the host
```
