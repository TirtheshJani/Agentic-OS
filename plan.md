# Plan: Build a Claude Code Agentic OS

## Context

Goal: turn the empty `Agentic-OS` repo into a working Claude Code–powered "Agentic OS" — the system described in the two YouTube transcripts (`e71caafa-Claude_Code_Transcripts.txt`) and your three-step write-up, layered with the spec/standards conventions from [buildermethods/agent-os](https://github.com/buildermethods/agent-os) and built **strictly to the official Anthropic Skills spec** ([anthropics/skills](https://github.com/anthropics/skills), "The Complete Guide to Building Skills for Claude").

Three layers, plus a spec/standards "layer 0":

0. **Spec layer (agent-os conventions)** — `standards/`, `instructions/`, `specs/`, `product/`. Codifies *how* we build code/skills in this repo.
1. **Architecture layer** — `skills/<domain>/<skill>/SKILL.md` (+ optional `scripts/`, `references/`, `assets/`), `automations/`. Codifies *what work gets done*. Uses progressive disclosure per the official guide.
2. **Memory layer** — `vault/` (Obsidian: `raw/` / `wiki/` / `outputs/` / `projects/` / `archive/`).
3. **Observability layer** — `dashboard/` (Next.js + Tailwind + shadcn/ui), backed by SQLite for run history; spawns `claude -p` headless.

### Reference materials studied (informing this plan)

- **Anthropic Skills spec & guide** — folder structure (`SKILL.md` required, `scripts/`, `references/`, `assets/` optional, **no `README.md` inside skill folders**); kebab-case names; YAML frontmatter rules (only `name`, `description`, `license`, `allowed-tools`, `metadata` are valid top-level fields; description must include WHAT + WHEN, ≤1024 chars, no XML tags); body ≤500 lines with progressive disclosure to `references/`; reserved name prefixes `claude`/`anthropic` are forbidden.
- **`anthropics/skills` repo** — `skills/`, `spec/`, `template/` layout. Template's `SKILL.md` is minimal: just `name` + `description` placeholder. Categories: Creative & Design, Development & Technical, Enterprise & Communication, Document Skills.
- **`anthropics/skills/skills/skill-creator`** — production skill-creator workflow (Capture Intent → Interview → Write SKILL.md → Test → Iterate). We vendor this rather than re-implement.
- **`forrestchang/andrej-karpathy-skills`** — `karpathy-guidelines` skill: a behavioral guidelines skill (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). We vendor this as a global behavioral skill.
- **`buildermethods/agent-os`** — `standards/` + `instructions/` + `specs/` + `product/` convention; specs numbered `NNNN-name.md`.
- **Anthropic "Building Effective Agents"** — informs orchestrator/worker patterns we use in skill descriptions (sequential workflow, multi-MCP coordination, iterative refinement, context-aware tool selection — all five patterns from the guide are referenced in `standards/skill-authoring.md`).

### Decisions locked in

| Question | Answer |
|---|---|
| Scope | All three layers + spec layer |
| Domains | research (general / physics-ml / healthcare-tech / data-science), content (substack / anxious-nomad / community), coding, business, productivity |
| Stack | Next.js 15 App Router + TS + Tailwind v4 + shadcn/ui |
| Vault location | `./vault` inside this repo |
| Always-on host | **Laptop only** → no cron/launchd; "local" automations are scripts/skills you invoke on demand. 24/7 work goes to Claude Code remote scheduled tasks. |
| Integrations | MCP servers already in this session (Gmail, Calendar, Notion, Drive, GitHub, Spotify, Canva), GitHub-native (trending/releases/issues), Firecrawl, academic sources (arXiv, Semantic Scholar) |
| Run history | **SQLite** via `better-sqlite3`, single file at `.agentic-os/state.db` |
| agent-os relationship | Layer its `standards/` + `instructions/` + `specs/` + `product/` conventions on top |
| Skills spec compliance | Strict Anthropic spec — frontmatter limited to `name` / `description` / `license` / `allowed-tools` / `metadata`. Custom fields (`status`, `mcp-server`, `domain`, `mode`) live under `metadata`. No `README.md` inside skill folders. |
| Vendored reference skills | `skills/_meta/skill-creator/` (Anthropic) + `skills/_meta/karpathy-guidelines/` (forrestchang) — cloned at bootstrap, kept in their original folder layout |
| Branch | `claude/init-project-setup-BNxJv` |

### Note on `plan.md`

You asked for the plan to live at `Agentic-OS/plan.md`. Plan mode restricts me to the harness plan file; once you approve via ExitPlanMode, **the very first execution step is to copy this plan to `Agentic-OS/plan.md`** so it ships in the repo.

---

## Repo Layout (target)

```
Agentic-OS/
├── plan.md                            # this plan, copied at execution start
├── README.md                          # bootstrap instructions (rewritten)
├── CLAUDE.md                          # root: explains OS layout to Claude Code
├── LICENSE                            # (existing)
├── .gitignore
├── .agentic-os/                       # runtime state (gitignored except .gitkeep)
│   └── state.db                       # SQLite: runs, schedules, vault_changes
├── .claude/
│   ├── settings.json                  # permissions, env (VAULT_PATH=./vault)
│   ├── commands/                      # repo-scoped slash commands
│   │   ├── scan.md                    # /scan → daily morning trend scan
│   │   ├── deep-research.md           # /deep-research <topic>
│   │   ├── vault-cleanup.md
│   │   └── new-skill.md               # wraps Anthropic's skill-creator
│   └── hooks/                         # optional SessionStart hook (later)
│
├── product/                           # agent-os: long-lived product docs
│   ├── mission.md                     # what this Agentic OS exists to do
│   ├── tech-stack.md                  # next.js, claude code, sqlite, etc.
│   ├── decisions.md                   # ADR-style log
│   └── roadmap.md
│
├── standards/                         # agent-os: how we write code/docs
│   ├── code-style.md                  # TS, React, Tailwind conventions
│   ├── skill-authoring.md             # SKILL.md frontmatter spec, naming, triggers
│   ├── automation-authoring.md        # local vs remote, schedule format
│   ├── vault-conventions.md           # naming, frontmatter, where things go
│   └── dashboard-ui.md                # shadcn usage, color tokens, layout grid
│
├── instructions/                      # agent-os: reusable how-tos for Claude
│   ├── add-skill.md                   # step-by-step: create a new skill
│   ├── add-automation.md
│   ├── add-dashboard-card.md
│   └── promote-raw-to-wiki.md         # vault workflow
│
├── specs/                             # agent-os: per-feature specs (NNNN-name.md)
│   └── 0001-initial-bootstrap.md      # spec for THIS plan's work
│
├── template/                          # mirrors anthropic/skills/template
│   └── SKILL.md                       # minimal stub: name + description only
│
├── skills/                            # progressive-disclosure skills per Anthropic spec
│   ├── _meta/                         # cross-cutting reference skills (vendored)
│   │   ├── skill-creator/             # cloned from anthropics/skills (full subtree)
│   │   │   ├── SKILL.md               # Anthropic's production skill-creator
│   │   │   ├── scripts/               # validation, eval helpers
│   │   │   └── references/
│   │   └── karpathy-guidelines/       # cloned from forrestchang/andrej-karpathy-skills
│   │       └── SKILL.md               # 4 principles: Think/Simplicity/Surgical/Goal-Driven
│   │
│   # Domain skills below — every folder is kebab-case, contains SKILL.md.
│   # scripts/ and references/ shown only on the few that need them initially;
│   # any skill may grow them later per progressive disclosure.
│   │
│   ├── research/
│   │   ├── general/
│   │   │   ├── deep-web-research/
│   │   │   │   ├── SKILL.md                     # uses Firecrawl + Drive MCPs
│   │   │   │   └── references/firecrawl-tips.md # rate limits, selectors
│   │   │   ├── youtube-search/SKILL.md
│   │   │   └── morning-trend-scan/SKILL.md      # GitHub MCP + arXiv
│   │   ├── physics-ml/
│   │   │   ├── arxiv-daily-digest/
│   │   │   │   ├── SKILL.md
│   │   │   │   └── references/arxiv-categories.md
│   │   │   ├── paper-summary/SKILL.md           # Semantic Scholar API
│   │   │   └── ml-twitter-watch/SKILL.md
│   │   ├── healthcare-tech/
│   │   │   ├── pubmed-digest/SKILL.md
│   │   │   ├── healthcare-arxiv/SKILL.md
│   │   │   └── regulatory-watch/SKILL.md        # FDA/CE RSS
│   │   └── data-science/
│   │       ├── kaggle-watch/SKILL.md
│   │       ├── dataset-scan/SKILL.md
│   │       └── benchmark-tracker/SKILL.md
│   ├── content/
│   │   ├── substack/
│   │   │   ├── draft-from-vault/
│   │   │   │   ├── SKILL.md
│   │   │   │   └── assets/post-template.md      # Substack post skeleton
│   │   │   └── substack-publish-prep/SKILL.md
│   │   ├── anxious-nomad/
│   │   │   ├── collective-update/SKILL.md
│   │   │   └── newsletter-roundup/SKILL.md
│   │   └── community/
│   │       ├── comment-digest/SKILL.md          # Gmail MCP
│   │       └── engagement-report/SKILL.md
│   ├── coding/
│   │   ├── pr-review-prep/SKILL.md              # GitHub MCP
│   │   ├── repo-onboarding/SKILL.md
│   │   └── issue-triage/SKILL.md
│   ├── business/
│   │   ├── inbox-triage/
│   │   │   ├── SKILL.md                         # Gmail MCP
│   │   │   └── references/triage-rubric.md
│   │   ├── calendar-prep/SKILL.md               # Calendar MCP
│   │   └── weekly-rollup/SKILL.md               # Notion MCP
│   └── productivity/
│       ├── daily-rollup/SKILL.md
│       └── vault-cleanup/SKILL.md
│
├── automations/
│   ├── local/                         # scripts you invoke when laptop is open
│   │   ├── README.md
│   │   └── morning-scan.sh            # example: `claude -p ...`
│   └── remote/                        # Claude Code scheduled task definitions
│       ├── README.md
│       └── github-daily.md            # example: every 9am, scan GH trending
│
├── vault/                             # Obsidian vault
│   ├── CLAUDE.md                      # tells Claude how memory is structured
│   ├── .obsidian/app.json             # minimal config (theme, daily-notes path)
│   ├── raw/
│   │   └── daily/.gitkeep
│   ├── wiki/
│   │   ├── research/{general,physics-ml,healthcare-tech,data-science}/.gitkeep
│   │   ├── content/{substack,anxious-nomad,community}/.gitkeep
│   │   ├── coding/.gitkeep
│   │   ├── business/.gitkeep
│   │   └── productivity/.gitkeep
│   ├── outputs/.gitkeep
│   ├── projects/.gitkeep
│   └── archive/.gitkeep
│
├── dashboard/                         # Next.js 15 App Router + TS
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # main command center
│   │   ├── globals.css
│   │   └── api/
│   │       ├── skills/route.ts        # GET — list skills (reads ../skills/**/SKILL.md)
│   │       ├── run/route.ts           # POST — spawn claude -p, stream SSE
│   │       ├── runs/route.ts          # GET — recent runs from SQLite
│   │       ├── vault/recent/route.ts  # GET — last 20 vault file changes
│   │       └── usage/route.ts         # GET — best-effort usage from ~/.claude
│   ├── components/
│   │   ├── skills-rail.tsx            # left: skills grouped by domain
│   │   ├── prompt-panel.tsx           # center: editable prompt + Run
│   │   ├── output-stream.tsx          # center: live SSE output
│   │   ├── recent-runs-card.tsx       # right
│   │   ├── vault-recent-card.tsx      # right
│   │   ├── usage-card.tsx             # right (5h + weekly)
│   │   └── forecast-card.tsx          # right (upcoming scheduled tasks)
│   ├── lib/
│   │   ├── paths.ts                   # repoRoot, vaultPath, skillsPath
│   │   ├── skills-loader.ts           # walk skills/**/SKILL.md, parse frontmatter
│   │   ├── claude-headless.ts         # spawn('claude', ['-p', ...]) → AsyncIterable
│   │   ├── db.ts                      # better-sqlite3 singleton + migrations
│   │   └── vault-watcher.ts           # fs.watch vault → INSERT vault_changes
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── components.json                # shadcn config
│   └── next.config.ts
│
└── prompts/                           # one-shot conversational prompts
    ├── architecture-setup.md          # the stream-of-consciousness intake
    ├── skill-creator.md               # wraps Anthropic's skill-creator pattern
    └── dashboard-setup.md             # evolve dashboard contents
```

---

## Layer 0 — Spec & Standards (agent-os conventions)

**Purpose:** when Claude Code (or you) later add a new skill / automation / dashboard card, the rules already exist. No re-deriving conventions.

### Files & contents

- `product/mission.md` — one-page mission: who this is for, the three gaps (memory/consistency/access), success criteria.
- `product/tech-stack.md` — Claude Code, Next.js 15, Tailwind v4, shadcn/ui, better-sqlite3, Obsidian, Anthropic skill-creator. Pinned versions where it matters.
- `product/decisions.md` — ADR-001: SQLite over JSONL (queryable forecast). ADR-002: laptop-only host (no cron). ADR-003: skills as folders, not single files.
- `product/roadmap.md` — Phase 1 = bootstrap (this plan). Phase 2 = fill skills via `prompts/architecture-setup.md`. Phase 3 = wire MCP integrations into specific skills. Phase 4 = remote scheduled tasks.
- `standards/code-style.md` — TypeScript strict, no default exports for components, Tailwind class order via prettier-plugin-tailwindcss, server actions for mutations.
- `standards/skill-authoring.md` — written **directly from the Anthropic Skills spec**. Covers: (1) folder rules — kebab-case name, exact `SKILL.md` filename, no `README.md` inside; (2) frontmatter — only `name`, `description`, `license`, `allowed-tools`, `metadata` are valid top-level keys; description must include WHAT + WHEN + trigger phrases, ≤1024 chars, no `<`/`>`; reserved name prefixes `claude`/`anthropic`; (3) progressive disclosure — body ≤500 lines, link to `references/*.md` for detail, `scripts/*` for deterministic checks, `assets/*` for templates; (4) the five orchestration patterns (sequential, multi-MCP, iterative refinement, context-aware tool selection, domain-specific intelligence) with one-line guidance on when to use each; (5) custom metadata convention used here — `metadata.status` (stub|authored), `metadata.domain`, `metadata.mode` (local|remote), `metadata.mcp-server`, `metadata.external-apis`, `metadata.outputs`. Cites the source guide so future authors can verify.
- `standards/automation-authoring.md` — local = `.sh` invoking `claude -p`; remote = a markdown spec read by Claude Code's scheduled-task runner with cron expression.
- `standards/vault-conventions.md` — daily notes in `raw/daily/YYYY-MM-DD.md`, wiki articles named kebab-case, frontmatter `{ domain, source, created, updated, tags }`.
- `standards/dashboard-ui.md` — three-column grid: 280px / 1fr / 320px; cards use shadcn `Card`; output stream uses `ScrollArea`; status badges via `Badge`.
- `instructions/add-skill.md` — read `standards/skill-authoring.md`, then **delegate to `skills/_meta/skill-creator`** (don't reinvent the workflow). Dashboard auto-discovers via filesystem walk; no registration step.
- `instructions/add-automation.md` — same idea for automations.
- `instructions/add-dashboard-card.md` — create component in `dashboard/components/`, slot it into `app/page.tsx`'s right rail.
- `instructions/promote-raw-to-wiki.md` — workflow for `raw/` → `wiki/<domain>/` consolidation.
- `specs/0001-initial-bootstrap.md` — captures THIS work as a spec so the convention is demonstrated from day one.

### Why this exists
Without it, every new skill is a fresh negotiation between you and Claude Code over format. With it, you point at `standards/skill-authoring.md` and say "follow it."

---

## Layer 1 — Architecture (skills + automations)

### Skill scaffolding (spec-compliant)

Every skill gets a kebab-case folder with a **stub** `SKILL.md` whose frontmatter only uses fields permitted by the official spec (`name`, `description`, `license`, `allowed-tools`, `metadata`). Custom fields go under `metadata`:

```md
---
name: arxiv-daily-digest
description: Pull today's arXiv submissions in physics and ML categories, summarize each, and write a daily digest to vault/wiki/research/physics-ml/. Use when the user asks for "arxiv digest", "today's physics papers", "ML paper roundup", or "what's new on arxiv".
license: MIT
metadata:
  status: stub
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [arxiv]
  outputs: [vault/wiki/research/physics-ml/arxiv-YYYY-MM-DD.md]
---

# arxiv-daily-digest

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).

## Inputs
- categories: default ["physics.med-ph", "cs.LG", "stat.ML"]

## Outputs
- vault/wiki/research/physics-ml/arxiv-YYYY-MM-DD.md
```

Notes:
- `description` includes BOTH what + when, and trigger phrases users would actually say. Under 1024 chars. No `<` or `>`.
- The dashboard reads `metadata.status: stub` to show an "unauthored" badge.
- Bodies stay under 500 lines; longer guidance moves to `references/*.md` and is linked from SKILL.md (progressive disclosure).
- No `README.md` is placed inside skill folders — that's an Anthropic spec rule. Per-skill human docs live under `references/`.
- User authors stub bodies via `prompts/architecture-setup.md` or `/new-skill` (the slash command invokes `skills/_meta/skill-creator`).

### Skill stubs scaffolded (folder per skill, stub SKILL.md per above)

- **research/general**: `deep-web-research` (firecrawl+drive), `youtube-search`, `morning-trend-scan` (github+arxiv)
- **research/physics-ml**: `arxiv-daily-digest`, `paper-summary` (semantic-scholar), `ml-twitter-watch`
- **research/healthcare-tech**: `pubmed-digest`, `healthcare-arxiv`, `regulatory-watch`
- **research/data-science**: `kaggle-watch`, `dataset-scan`, `benchmark-tracker`
- **content/substack**: `draft-from-vault`, `substack-publish-prep`
- **content/anxious-nomad**: `collective-update`, `newsletter-roundup`
- **content/community**: `comment-digest` (gmail), `engagement-report`
- **coding**: `pr-review-prep` (github mcp), `repo-onboarding`, `issue-triage`
- **business**: `inbox-triage` (gmail), `calendar-prep` (calendar), `weekly-rollup`
- **productivity**: `daily-rollup`, `vault-cleanup`

These give you ~25 buttons on the dashboard from day one — all stubs, but the structure is real.

### Automations

- `automations/local/README.md` — explains: laptop-only host means no cron. Local automations are shell scripts you run by hand (or via the dashboard) when the laptop is open.
- `automations/local/morning-scan.sh` — example: `exec claude -p "use the morning-trend-scan skill"`.
- `automations/remote/README.md` — how to register a Claude Code scheduled task using the markdown spec format.
- `automations/remote/github-daily.md` — example spec: every weekday 09:00, run `morning-trend-scan`, write to vault.

### Slash commands (`.claude/commands/`)

- `/scan` — kick off `morning-trend-scan` skill.
- `/deep-research <topic>` — invokes `deep-web-research`.
- `/vault-cleanup` — invokes `vault-cleanup` skill.
- `/new-skill` — thin wrapper that loads `skills/_meta/skill-creator` (Anthropic's production skill-creator) with extra context: this repo's domain folders, `standards/skill-authoring.md`, and the `metadata` field convention. Writes the result under `skills/<domain>/<name>/SKILL.md`.
- `/karpathy` — loads `skills/_meta/karpathy-guidelines` for any code-writing task in this repo (Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution).

---

## Layer 2 — Memory (Obsidian vault)

- `vault/CLAUDE.md` — appended to every prompt run inside vault. Spells out:
  - Vault root, folder purposes (`raw`, `wiki`, `outputs`, `projects`, `archive`).
  - Per-domain wiki subfolders (must match skills/ domain names).
  - Daily note convention: `raw/daily/YYYY-MM-DD.md` with frontmatter.
  - Promotion workflow: `raw/*` → `wiki/<domain>/<topic>.md` when codified.
  - "Never write to outputs/ unless producing a finished deliverable."
- `vault/.obsidian/app.json` — daily-notes folder = `raw/daily`, default theme.
- All subfolders created with `.gitkeep`.
- Vault sync is out of scope (you said it lives inside the repo) — git is the sync mechanism. Document this explicitly in `vault/CLAUDE.md`.

---

## Layer 3 — Observability (dashboard)

### Dependencies (locked in `dashboard/package.json`)
- `next@15`, `react@19`, `typescript@5`, `tailwindcss@4`
- `better-sqlite3` + `@types/better-sqlite3`
- `gray-matter` (parse SKILL.md frontmatter)
- `chokidar` (watch vault for changes)
- shadcn/ui components: `card`, `button`, `tabs`, `scroll-area`, `badge`, `input`, `separator`, `tooltip`, `toast`

### SQLite schema (`lib/db.ts`)

```sql
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_slug TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,          -- queued|running|done|error
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER,
  output_path TEXT,              -- vault file the skill wrote, if any
  error TEXT
);
CREATE INDEX idx_runs_started ON runs(started_at DESC);

CREATE TABLE vault_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,            -- add|change|unlink
  ts INTEGER NOT NULL
);
CREATE INDEX idx_vault_ts ON vault_changes(ts DESC);

CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_slug TEXT NOT NULL,
  cron TEXT NOT NULL,
  next_run_at INTEGER,
  source TEXT NOT NULL           -- 'remote-spec' (read from automations/remote/*.md)
);
```

Migrations run on dashboard boot. DB file lives at `.agentic-os/state.db` (gitignored).

### `lib/claude-headless.ts`

```ts
// signature
export async function* runClaude(opts: {
  prompt: string;
  cwd: string;             // must be repoRoot or vaultPath, validated
  runId: number;           // for streaming back to UI
}): AsyncGenerator<{ type: 'delta' | 'tool' | 'done' | 'error'; data: any }>;
```

- Spawns `claude -p <prompt> --output-format stream-json --verbose`.
- Parses JSONL events, yields normalized events.
- On `done`, updates `runs` row with `ended_at`, `duration_ms`, `status='done'`, and best-effort `output_path` (parsed from final assistant message's "wrote: ..." patterns or last Edit/Write tool target).
- On error, sets `status='error'` + `error` text.
- Prompt is passed as argv (no shell). cwd is whitelisted.

### `app/api/run/route.ts`

POST `{ skillSlug, userInput }`:
1. Load skill via `skills-loader`. 404 if not found.
2. Build prompt: `"Use the ${skill.name} skill. Inputs: ${userInput}"` (configurable per skill via frontmatter `prompt_template`).
3. Insert `runs` row (`status='running'`).
4. Stream `claude-headless` output back as SSE.
5. Frontend's `output-stream.tsx` consumes via `EventSource`.

### Page layout (`app/page.tsx`)

```
┌──────────────────────────────────────────────────────────────┐
│  Agentic OS                                  [Open Vault] [⚙] │
├──────────┬───────────────────────────────────┬───────────────┤
│ Skills   │ Prompt                            │ Usage 5h      │
│ ─────    │ [editable textarea, prefilled]    │ [bar]         │
│ research │ [Run]                             │ Usage week    │
│ ▸ general│                                   │ [bar]         │
│ ▸ physics│ Output                            ├───────────────┤
│ ▸ health │ [streaming SSE log]               │ Recent runs   │
│ ▸ data   │                                   │ [last 8]      │
│ content  │                                   ├───────────────┤
│ coding   │                                   │ Vault recent  │
│ business │                                   │ [last 8 files]│
│ prod.    │                                   ├───────────────┤
│          │                                   │ Forecast      │
│ [+ New]  │                                   │ [next runs]   │
└──────────┴───────────────────────────────────┴───────────────┘
```

### Security
- Server binds `127.0.0.1` only (document in README; don't expose without auth).
- `/api/run` rejects any prompt > 32KB and any `cwd` not in the allowlist.
- No client-supplied flags or shell forwarded to `claude`.

---

## Build order (after plan approval)

Each step ends with a commit on `claude/init-project-setup-BNxJv`.

1. **Plan + docs**: copy `.claude/plans/...md` → `Agentic-OS/plan.md`. Write root `CLAUDE.md`, expanded `README.md`, `.gitignore` (ignores `node_modules/`, `.agentic-os/state.db`, `.next/`, dashboard build output).
2. **Spec layer**: create `product/{mission,tech-stack,decisions,roadmap}.md`, `standards/{code-style,skill-authoring,automation-authoring,vault-conventions,dashboard-ui}.md`, `instructions/{add-skill,add-automation,add-dashboard-card,promote-raw-to-wiki}.md`, `specs/0001-initial-bootstrap.md`. `standards/skill-authoring.md` quotes/cites the official Anthropic Skills guide.
3. **Template & vendored reference skills**: create `template/SKILL.md` (mirroring `anthropics/skills/template`); shallow-clone `anthropics/skills` and `forrestchang/andrej-karpathy-skills` into a tmp dir; copy `skill-creator/` and `karpathy-guidelines/` subtrees verbatim into `skills/_meta/`; record provenance + commit SHAs in `product/decisions.md`.
4. **Domain skill scaffolding**: for each of the ~25 domain skills, create folder + spec-compliant stub `SKILL.md` (frontmatter uses only valid keys; `metadata.status: stub`). Add the few `references/`/`assets/` files shown in the layout.
5. **Automations + prompts**: `automations/{local,remote}/README.md` plus one example each (`local/morning-scan.sh`, `remote/github-daily.md`). `prompts/{architecture-setup,skill-creator,dashboard-setup}.md`.
6. **Memory layer**: create `vault/` tree + `vault/CLAUDE.md` + `vault/.obsidian/app.json`.
7. **Slash commands & settings**: `.claude/commands/{scan,deep-research,vault-cleanup,new-skill,karpathy}.md` and `.claude/settings.json` (sets `VAULT_PATH=./vault`, baseline allowlist for read-only Bash + the MCP tools we'll use).
8. **Dashboard bootstrap**: `npx create-next-app@latest dashboard --ts --tailwind --app --eslint --no-src-dir --import-alias="@/*"`. Install shadcn + components above + `better-sqlite3`, `gray-matter`, `chokidar`.
9. **Dashboard libs**: `lib/paths.ts`, `lib/db.ts` (with migrations), `lib/skills-loader.ts` (parses `metadata.status`/`metadata.domain` for grouping + badging), `lib/claude-headless.ts`, `lib/vault-watcher.ts`.
10. **Dashboard API**: `/api/skills`, `/api/run` (SSE), `/api/runs`, `/api/vault/recent`, `/api/usage`.
11. **Dashboard UI**: `app/page.tsx` + 7 components. Stub skills get a muted "stub" badge; authored skills get a "ready" badge.
12. **Verify**: `npm run build`, `npm run lint`, `tsc --noEmit`, plus a SKILL.md validator script that asserts every skill has spec-compliant frontmatter (only valid top-level keys, description ≤1024 chars, no XML brackets, no reserved name prefixes, no `README.md` inside the folder).
13. **Push**: `git push -u origin claude/init-project-setup-BNxJv` with retry-on-network-error.

---

## Verification

### Static
- `tree -L 3 -I node_modules .` matches the layout above.
- `cat plan.md` (= this file).
- `cat skills/research/physics-ml/arxiv-daily-digest/SKILL.md` shows spec-compliant frontmatter with `metadata.status: stub`.
- `cat standards/skill-authoring.md` defines the same conventions used in stubs and cites the Anthropic guide.
- `node dashboard/scripts/validate-skills.mjs` (or equivalent) walks `skills/**/SKILL.md` and asserts: only valid top-level frontmatter keys; `description` length ≤1024 and no `<`/`>`; folder name kebab-case; no `README.md` inside any skill folder; no skill name starts with `claude` or `anthropic`. Exits 0.
- `skills/_meta/skill-creator/SKILL.md` and `skills/_meta/karpathy-guidelines/SKILL.md` exist verbatim from upstream, with provenance noted in `product/decisions.md`.

### Dashboard
- `cd dashboard && npm run build` exits 0; `npm run lint` clean; `npx tsc --noEmit` clean.
- `npm run dev` → http://localhost:3000 loads, skills rail shows ~25 buttons grouped by 5 domains, all with "stub" badge.
- Click a skill button → prompt panel populates.
- Click **Run** with Claude Code on PATH → SSE stream prints events; `runs` row inserts (`sqlite3 .agentic-os/state.db 'select * from runs;'`).
- Touch a file under `vault/` → `vault_changes` row inserts within 1s; "Vault recent" card updates on next poll.

### End-to-end smoke
- Author one stub via `/new-skill` (which delegates to `skills/_meta/skill-creator`): pick `productivity/vault-cleanup`, follow the Capture Intent → Interview → Write SKILL.md flow, set `metadata.status: authored`.
- Click the button on the dashboard → it actually executes via `claude -p` → output streams → result file path captured in `runs.output_path`.
- Run `/karpathy` in any session inside this repo — confirm `skills/_meta/karpathy-guidelines/SKILL.md` loads (visible in tool/skill-load events).

### Branch hygiene
- `git status` clean after each phase commit.
- `git log --oneline` shows ~10 logical commits on `claude/init-project-setup-BNxJv`.
- Pushed to origin (with up to 4 retries on network error per session instructions).

---

## Out of scope (explicitly)

- Authoring skill bodies for any of the ~25 stub skills (you'll do that interactively via `prompts/architecture-setup.md` / `/new-skill`).
- Authentication on the dashboard (localhost only).
- Cloud/team deployment.
- Vector DB / LightRAG / Supabase memory.
- Vault sync beyond `git` (no Obsidian Sync, iCloud, Syncthing).
- Auto-running scheduled tasks during this bootstrap — schedules are *defined* in `automations/remote/*.md` but not *triggered* until you register them with Claude Code's scheduled-task runner.
- Mobile dashboard or remote dashboard access.
