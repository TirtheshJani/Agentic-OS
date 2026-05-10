# Tech stack

## Runtime

- **Claude Code** — primary agent runtime. The dashboard spawns
  `claude -p <prompt> --output-format stream-json --verbose` headlessly and
  parses JSONL events.
- **Node.js 22 LTS** — required by Next.js 15 and `better-sqlite3`.
- **Git** — sole sync mechanism for the vault and the repo.

## Skills layer

- **Anthropic Skills spec** — `SKILL.md` + optional `scripts/`,
  `references/`, `assets/`. See `standards/skill-authoring.md`.
- **Vendored reference skills** under `skills/_meta/`:
  - `skill-creator` — from `anthropics/skills`.
  - `karpathy-guidelines` — from `forrestchang/andrej-karpathy-skills`.

## Memory layer

- **Obsidian** vault at `./vault`. Folders: `raw/`, `wiki/`, `outputs/`,
  `projects/`, `archive/`. Daily notes in `raw/daily/YYYY-MM-DD.md`.

## Dashboard

- **Next.js 15** App Router, **React 19**, **TypeScript 5** (strict).
- **Tailwind CSS v4** + **shadcn/ui** components: `card`, `button`, `tabs`,
  `scroll-area`, `badge`, `input`, `separator`, `tooltip`, `toast`.
- **better-sqlite3** for run history, vault changes, schedules. Single DB
  file at `.agentic-os/state.db` (gitignored).
- **gray-matter** for parsing SKILL.md frontmatter.
- **chokidar** for watching `vault/` for file changes.

## Integrations (skill-level, not framework-level)

- **MCP servers** available in this session: Gmail, Calendar, Notion,
  Drive, GitHub, Spotify, Canva. Skills declare which they need under
  `metadata.mcp-server`.
- **GitHub-native** APIs (trending, releases, issues) via the GitHub MCP.
- **Firecrawl** for deep web research.
- **Academic** sources: arXiv API, Semantic Scholar API, PubMed (NCBI).

## Versions worth pinning

| Package | Version | Why |
|---|---|---|
| `next` | 15.x | App Router + RSC + streaming required |
| `react` | 19.x | Concurrent features used by SSE consumer |
| `tailwindcss` | 4.x | New zero-config + CSS-first theming |
| `better-sqlite3` | 11.x | Sync API; works with Next.js server actions |
