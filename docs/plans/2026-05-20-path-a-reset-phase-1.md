# Path A Reset, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data model, migration script, and a read-only Home page that lists migrated projects from disk. No agent execution yet.

**Architecture:** Hard cutover. Rename current `dashboard/` to `dashboard-v1/`, scaffold a new `dashboard/` with Next.js 15 App Router and SQLite. Read project metadata from `vault/projects/*/PROJECT.md` and agent profiles from a flat `agents/<slug>.md`. Watch the filesystem with chokidar so the dashboard reflects edits in Obsidian without a restart. Migration script makes the schema and on-disk shape match Spec 0002.

**Tech Stack:** Next.js 15.1, React 19, TypeScript 5.6, Tailwind CSS 3.4, better-sqlite3 11.x, gray-matter 4.0, chokidar 4.0, vitest 2.1, zod 3.23.

**Spec:** `specs/0002-path-a-reset.md`.

---

## Phase 1 Scope

In scope:

- Move current `dashboard/` to `dashboard-v1/`. Preserve, do not run.
- Scaffold new `dashboard/`.
- Implement `lib/db.ts`, `lib/projects.ts`, `lib/agents.ts`, `lib/settings.ts`, `lib/watcher.ts`.
- Write `scripts/migrate-to-0002.ts` and run it once locally.
- Build read-only Home page (`app/page.tsx`) listing projects with running-sessions strip stubbed (empty for now).
- Build read-only stub Project page (`app/projects/[slug]/page.tsx`) showing path, repo, crew, capabilities. No kanban, no crew editing.
- Vitest test suite covering schemas, parsers, migration logic.

Out of scope for this phase:

- Issue CRUD, kanban UI, crew picker (Phase 2).
- Runtime registry, PTY spawn, xterm.js (Phase 3).
- Agent edit UI (Phase 4).
- Hooks endpoint and SessionStart correlation (Phase 5).
- Settings page UI (Phase 6).
- Any agent execution.

## Verification strategy

Each task ends with a runnable command and a stated expected output. Phase-level definition of done:

1. `cd dashboard && npm run dev` boots without error.
2. Open `http://localhost:3000`. Home page lists all migrated projects from `vault/projects/`. Each project card shows name, path, last-activity timestamp.
3. Click a project. The stub project page renders, showing path, repo URL (if any), crew (empty array on first migration), and capabilities tags.
4. `vitest run` passes all tests in the new `dashboard/` workspace.
5. Migration script is idempotent: running it twice produces no changes the second time and exits 0.
6. The QML healthcare diagnostics project appears on Home with its correct workspace path.

## File structure

New files this phase creates or replaces:

```
dashboard/                                    # NEW, scaffolded fresh
  package.json
  tsconfig.json
  next.config.ts
  tailwind.config.ts
  postcss.config.mjs
  vitest.config.ts
  app/
    layout.tsx
    page.tsx                                  # Home
    globals.css
    projects/
      [slug]/page.tsx                         # Stub project page
    api/
      projects/route.ts                       # GET list of projects
      projects/[slug]/route.ts                # GET single project
  components/
    home/
      ProjectCard.tsx
      RunningSessionsStrip.tsx
    common/
      EmptyState.tsx
  lib/
    db.ts
    projects.ts
    agents.ts
    settings.ts
    watcher.ts
    paths.ts
    schemas.ts
  scripts/
    migrate-to-0002.ts
  tests/
    schemas.test.ts
    projects.test.ts
    agents.test.ts
    settings.test.ts
    migrate.test.ts
    fixtures/
      vault/projects/sample/PROJECT.md
      agents/sample-agent.md
  .gitignore
  README.md

dashboard-v1/                                  # MOVED from old dashboard/
  (existing files, untouched)

.agentic-os/
  settings.json                                # NEW, created by first run
  state.db                                     # MIGRATED in-place
```

The `dashboard-v1/` rename happens once at the start of Task 1 and is never touched again.

---

## Task 1: Cutover and Next.js scaffold

**Files:**
- Rename: `dashboard/` to `dashboard-v1/`
- Create: `dashboard/package.json`, `dashboard/tsconfig.json`, `dashboard/next.config.ts`, `dashboard/tailwind.config.ts`, `dashboard/postcss.config.mjs`, `dashboard/app/layout.tsx`, `dashboard/app/page.tsx`, `dashboard/app/globals.css`, `dashboard/.gitignore`, `dashboard/README.md`

- [ ] **Step 1: Rename the existing dashboard to preserve it.**

Run from repo root:
```bash
git mv dashboard dashboard-v1
git commit -m "chore: rename dashboard to dashboard-v1 ahead of Path A reset"
```

Expected: clean commit. `dashboard/` no longer exists; `dashboard-v1/` does.

- [ ] **Step 2: Scaffold new dashboard with Next.js 15.**

Run from repo root:
```bash
mkdir dashboard && cd dashboard
npm init -y
npm install next@15.1.0 react@19.0.0 react-dom@19.0.0
npm install -D typescript@5.6.3 @types/react@19.0.1 @types/node@22.10.2 @types/react-dom@19.0.2
npm install -D tailwindcss@3.4.17 postcss@8.4.49 autoprefixer@10.4.20
```

Expected: `node_modules` populated, `package.json` updated.

- [ ] **Step 3: Create `dashboard/package.json` scripts and metadata.**

Overwrite `dashboard/package.json` with:
```json
{
  "name": "agentic-os-dashboard",
  "version": "0.2.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "migrate": "tsx scripts/migrate-to-0002.ts"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "better-sqlite3": "11.7.0",
    "gray-matter": "4.0.3",
    "chokidar": "4.0.1",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "7.6.12",
    "@types/node": "22.10.2",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.2",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.17",
    "tsx": "4.19.2",
    "typescript": "5.6.3",
    "vitest": "2.1.8",
    "@vitest/ui": "2.1.8"
  }
}
```

Run:
```bash
npm install
```

Expected: all deps installed without peer-dep errors.

- [ ] **Step 4: Create `dashboard/tsconfig.json`.**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dashboard-v1"]
}
```

- [ ] **Step 5: Create `dashboard/next.config.ts`.**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "chokidar"],
  },
};

export default nextConfig;
```

- [ ] **Step 6: Set up Tailwind.**

Create `dashboard/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

Create `dashboard/postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

Create `dashboard/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light dark;
}

body {
  font-family: ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 7: Create a minimal `app/layout.tsx` and `app/page.tsx` for boot smoke test.**

`dashboard/app/layout.tsx`:
```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic OS",
  description: "Personal command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`dashboard/app/page.tsx` (will be replaced in Task 9):
```tsx
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Agentic OS</h1>
      <p className="text-sm text-gray-500 mt-2">Phase 1 scaffold. Real Home page coming in Task 9.</p>
    </main>
  );
}
```

- [ ] **Step 8: Create `.gitignore` and `README.md`.**

`dashboard/.gitignore`:
```
node_modules
.next
out
*.log
.DS_Store
.env.local
```

`dashboard/README.md`:
```markdown
# Agentic OS Dashboard

Path A reset rebuild. See `specs/0002-path-a-reset.md`.

## Develop
```
npm install
npm run migrate    # one-time
npm run dev
```
```

- [ ] **Step 9: Verify dev server boots.**

Run from `dashboard/`:
```bash
npm run dev
```

Expected: Next.js prints "ready started server on 0.0.0.0:3000". Browse to `http://localhost:3000`, see the "Agentic OS" heading. Stop with Ctrl-C.

- [ ] **Step 10: Commit.**

```bash
cd ..
git add dashboard/ .gitignore
git commit -m "feat(dashboard): scaffold Next.js 15 app for Path A reset"
```

---

## Task 2: Path utilities and settings module

**Files:**
- Create: `dashboard/lib/paths.ts`, `dashboard/lib/settings.ts`
- Create: `dashboard/tests/settings.test.ts`, `dashboard/vitest.config.ts`

- [ ] **Step 1: Add Vitest config.**

`dashboard/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 2: Write `lib/paths.ts`.**

```ts
// dashboard/lib/paths.ts
import path from "node:path";
import os from "node:os";

// Repo root is two directories up from the dashboard package.
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const VAULT_DIR = path.join(REPO_ROOT, "vault");
export const VAULT_PROJECTS_DIR = path.join(VAULT_DIR, "projects");
export const AGENTS_DIR = path.join(REPO_ROOT, "agents");
export const SKILLS_DIR = path.join(REPO_ROOT, "skills");

export const STATE_DIR = path.join(REPO_ROOT, ".agentic-os");
export const STATE_DB_PATH = path.join(STATE_DIR, "state.db");
export const SETTINGS_PATH = path.join(STATE_DIR, "settings.json");
export const MIGRATIONS_DIR = path.join(STATE_DIR, "migrations");

export function defaultWorkspaceRoot(): string {
  if (process.platform === "win32") {
    return path.join(os.homedir(), "code");
  }
  return path.join(os.homedir(), "code");
}
```

- [ ] **Step 3: Write the failing test for settings.**

`dashboard/tests/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Test helpers must come before the import under test if it reads env vars,
// but settings.ts reads from disk only, so import below is fine.
import { getSettings, setSettings, resetSettingsForTesting } from "@/lib/settings";

const TMP = path.join(os.tmpdir(), `agentic-os-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(TMP, { recursive: true });
  process.env.AGENTIC_OS_STATE_DIR = TMP;
  resetSettingsForTesting();
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  delete process.env.AGENTIC_OS_STATE_DIR;
});

describe("settings", () => {
  it("returns defaults when settings.json does not exist", () => {
    const s = getSettings();
    expect(s.workspaceRoot).toMatch(/code$/);
    expect(s.concurrency.perProjectMax).toBe(3);
    expect(s.concurrency.globalMax).toBe(5);
  });

  it("persists changes to disk", () => {
    setSettings({ workspaceRoot: "/tmp/mycode" });
    const reloaded = getSettings();
    expect(reloaded.workspaceRoot).toBe("/tmp/mycode");
  });

  it("merges partial updates without losing other fields", () => {
    setSettings({ workspaceRoot: "/tmp/a" });
    setSettings({ concurrency: { perProjectMax: 10, globalMax: 20 } });
    const s = getSettings();
    expect(s.workspaceRoot).toBe("/tmp/a");
    expect(s.concurrency.perProjectMax).toBe(10);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails.**

```bash
npm test
```

Expected: 3 failures, all with message about `getSettings is not a function` or similar import error.

- [ ] **Step 5: Implement `lib/settings.ts`.**

```ts
// dashboard/lib/settings.ts
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { defaultWorkspaceRoot, STATE_DIR as DEFAULT_STATE_DIR, SETTINGS_PATH as DEFAULT_SETTINGS_PATH } from "@/lib/paths";

const SettingsSchema = z.object({
  workspaceRoot: z.string(),
  concurrency: z.object({
    perProjectMax: z.number().int().positive(),
    globalMax: z.number().int().positive(),
  }),
  theme: z.enum(["light", "dark", "system"]).default("system"),
});

export type Settings = z.infer<typeof SettingsSchema>;

function stateDir(): string {
  return process.env.AGENTIC_OS_STATE_DIR ?? DEFAULT_STATE_DIR;
}

function settingsPath(): string {
  return process.env.AGENTIC_OS_STATE_DIR
    ? path.join(process.env.AGENTIC_OS_STATE_DIR, "settings.json")
    : DEFAULT_SETTINGS_PATH;
}

function defaults(): Settings {
  return {
    workspaceRoot: defaultWorkspaceRoot(),
    concurrency: { perProjectMax: 3, globalMax: 5 },
    theme: "system",
  };
}

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  const p = settingsPath();
  if (!fs.existsSync(p)) {
    cache = defaults();
    return cache;
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const parsed = SettingsSchema.safeParse({ ...defaults(), ...raw });
  cache = parsed.success ? parsed.data : defaults();
  return cache;
}

export function setSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const next: Settings = {
    ...current,
    ...patch,
    concurrency: { ...current.concurrency, ...(patch.concurrency ?? {}) },
  };
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  cache = next;
  return next;
}

export function resetSettingsForTesting() {
  cache = null;
}
```

- [ ] **Step 6: Run the test to verify it passes.**

```bash
npm test
```

Expected: 3 passing.

- [ ] **Step 7: Commit.**

```bash
git add dashboard/lib/paths.ts dashboard/lib/settings.ts dashboard/tests/settings.test.ts dashboard/vitest.config.ts
git commit -m "feat(dashboard): paths and settings module with persistence"
```

---

## Task 3: Schemas module

**Files:**
- Create: `dashboard/lib/schemas.ts`, `dashboard/tests/schemas.test.ts`

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ProjectFrontmatterSchema, AgentFrontmatterSchema, parseProjectFrontmatter, parseAgentFrontmatter } from "@/lib/schemas";

describe("ProjectFrontmatterSchema", () => {
  it("accepts a complete project frontmatter", () => {
    const ok = ProjectFrontmatterSchema.safeParse({
      name: "QML Healthcare",
      slug: "qml-healthcare",
      path: "C:/Users/TJ/code/qml-healthcare",
      repo: "https://github.com/x/y",
      crew: ["lit-reviewer", "physicist"],
      "runtime-default": "claude-code",
      capabilities: ["research", "physics"],
      created: "2026-05-20",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects when slug has whitespace", () => {
    const bad = ProjectFrontmatterSchema.safeParse({
      name: "x",
      slug: "with space",
      path: "/x",
      "runtime-default": "claude-code",
      capabilities: [],
      crew: [],
      created: "2026-05-20",
    });
    expect(bad.success).toBe(false);
  });

  it("fills defaults for crew, capabilities, runtime-default", () => {
    const parsed = parseProjectFrontmatter({
      name: "x",
      slug: "x",
      path: "/x",
      created: "2026-05-20",
    });
    expect(parsed.crew).toEqual([]);
    expect(parsed.capabilities).toEqual([]);
    expect(parsed["runtime-default"]).toBe("claude-code");
  });
});

describe("AgentFrontmatterSchema", () => {
  it("accepts a complete agent frontmatter", () => {
    const ok = AgentFrontmatterSchema.safeParse({
      name: "Literature Reviewer",
      slug: "lit-reviewer",
      runtime: "claude-code",
      "allowed-tools": ["Read", "Edit"],
      skills: ["research", "literature-review"],
      created: "2026-01-01",
    });
    expect(ok.success).toBe(true);
  });

  it("fills defaults for allowed-tools and skills", () => {
    const parsed = parseAgentFrontmatter({
      name: "x",
      slug: "x",
      runtime: "claude-code",
      created: "2026-01-01",
    });
    expect(parsed["allowed-tools"]).toEqual([]);
    expect(parsed.skills).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- schemas
```

Expected: module not found, all tests fail.

- [ ] **Step 3: Implement `lib/schemas.ts`.**

```ts
// dashboard/lib/schemas.ts
import { z } from "zod";

const slugRegex = /^[a-z0-9][a-z0-9-]*$/;

export const ProjectFrontmatterSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(slugRegex, "slug must be lowercase letters, digits, and hyphens"),
  path: z.string().min(1),
  repo: z.string().url().optional(),
  crew: z.array(z.string().regex(slugRegex)).default([]),
  "runtime-default": z.string().default("claude-code"),
  capabilities: z.array(z.string()).default([]),
  "allow-parallel-edits": z.boolean().optional(),
  created: z.string(), // ISO date string, not parsed to Date because YAML can stringify oddly
});

export type ProjectFrontmatter = z.infer<typeof ProjectFrontmatterSchema>;

export function parseProjectFrontmatter(raw: unknown): ProjectFrontmatter {
  return ProjectFrontmatterSchema.parse(raw);
}

export const AgentFrontmatterSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(slugRegex),
  runtime: z.string().default("claude-code"),
  "allowed-tools": z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  created: z.string(),
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

export function parseAgentFrontmatter(raw: unknown): AgentFrontmatter {
  return AgentFrontmatterSchema.parse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- schemas
```

Expected: all schemas tests pass.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/lib/schemas.ts dashboard/tests/schemas.test.ts
git commit -m "feat(dashboard): zod schemas for project and agent frontmatter"
```

---

## Task 4: Projects loader

**Files:**
- Create: `dashboard/lib/projects.ts`, `dashboard/tests/projects.test.ts`, `dashboard/tests/fixtures/vault/projects/sample/PROJECT.md`

- [ ] **Step 1: Create fixture.**

`dashboard/tests/fixtures/vault/projects/sample/PROJECT.md`:
```markdown
---
name: Sample Project
slug: sample
path: /tmp/sample-project
repo: https://github.com/example/sample
crew:
  - lit-reviewer
  - physicist
runtime-default: claude-code
capabilities:
  - research
  - physics
created: 2026-05-20
---

# Sample Project

Body content.
```

Also create an empty extra dir to test resilience:
```bash
mkdir -p dashboard/tests/fixtures/vault/projects/empty-dir
```

- [ ] **Step 2: Write the failing test.**

`dashboard/tests/projects.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { listProjects, getProject, parseProjectFile } from "@/lib/projects";

const FIXTURES = path.join(__dirname, "fixtures", "vault", "projects");

describe("projects loader", () => {
  it("parses a single PROJECT.md", () => {
    const p = parseProjectFile(path.join(FIXTURES, "sample", "PROJECT.md"));
    expect(p.name).toBe("Sample Project");
    expect(p.slug).toBe("sample");
    expect(p.crew).toEqual(["lit-reviewer", "physicist"]);
    expect(p["runtime-default"]).toBe("claude-code");
  });

  it("listProjects skips directories without PROJECT.md", () => {
    const all = listProjects(FIXTURES);
    expect(all).toHaveLength(1);
    expect(all[0].slug).toBe("sample");
  });

  it("getProject returns the matching project or null", () => {
    expect(getProject("sample", FIXTURES)?.name).toBe("Sample Project");
    expect(getProject("nope", FIXTURES)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails.**

```bash
npm test -- projects
```

Expected: module not found, 3 failures.

- [ ] **Step 4: Implement `lib/projects.ts`.**

```ts
// dashboard/lib/projects.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseProjectFrontmatter, ProjectFrontmatter } from "@/lib/schemas";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";

export interface Project extends ProjectFrontmatter {
  filePath: string;          // absolute path to PROJECT.md
  bodyMarkdown: string;       // anything after the frontmatter
  lastModified: number;       // mtime in ms
}

export function parseProjectFile(filePath: string): Project {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parseProjectFrontmatter(parsed.data);
  const stat = fs.statSync(filePath);
  return {
    ...fm,
    filePath,
    bodyMarkdown: parsed.content.trim(),
    lastModified: stat.mtimeMs,
  };
}

export function listProjects(rootDir: string = VAULT_PROJECTS_DIR): Project[] {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectFile = path.join(rootDir, entry.name, "PROJECT.md");
    if (!fs.existsSync(projectFile)) continue;
    try {
      projects.push(parseProjectFile(projectFile));
    } catch (err) {
      console.warn(`[projects] skipping ${projectFile}: ${(err as Error).message}`);
    }
  }
  return projects.sort((a, b) => b.lastModified - a.lastModified);
}

export function getProject(slug: string, rootDir: string = VAULT_PROJECTS_DIR): Project | null {
  const projectFile = path.join(rootDir, slug, "PROJECT.md");
  if (!fs.existsSync(projectFile)) return null;
  try {
    return parseProjectFile(projectFile);
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes.**

```bash
npm test -- projects
```

Expected: 3 passing.

- [ ] **Step 6: Commit.**

```bash
git add dashboard/lib/projects.ts dashboard/tests/projects.test.ts dashboard/tests/fixtures/
git commit -m "feat(dashboard): projects loader reads vault/projects/*/PROJECT.md"
```

---

## Task 5: Agents loader

**Files:**
- Create: `dashboard/lib/agents.ts`, `dashboard/tests/agents.test.ts`, `dashboard/tests/fixtures/agents/sample-agent.md`

- [ ] **Step 1: Create fixture.**

`dashboard/tests/fixtures/agents/sample-agent.md`:
```markdown
---
name: Sample Agent
slug: sample-agent
runtime: claude-code
allowed-tools:
  - Read
  - Edit
  - Bash
skills:
  - research
  - writing
created: 2026-01-15
---

# System Prompt

You are a sample agent for testing.
```

- [ ] **Step 2: Write the failing test.**

`dashboard/tests/agents.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { listAgents, getAgent, parseAgentFile } from "@/lib/agents";

const FIXTURES = path.join(__dirname, "fixtures", "agents");

describe("agents loader", () => {
  it("parses a single agent file", () => {
    const a = parseAgentFile(path.join(FIXTURES, "sample-agent.md"));
    expect(a.name).toBe("Sample Agent");
    expect(a.slug).toBe("sample-agent");
    expect(a.runtime).toBe("claude-code");
    expect(a["allowed-tools"]).toContain("Read");
    expect(a.skills).toContain("research");
    expect(a.systemPrompt).toContain("sample agent for testing");
  });

  it("listAgents returns all .md files in the directory", () => {
    const all = listAgents(FIXTURES);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.find(a => a.slug === "sample-agent")).toBeTruthy();
  });

  it("getAgent returns matching agent or null", () => {
    expect(getAgent("sample-agent", FIXTURES)?.name).toBe("Sample Agent");
    expect(getAgent("nope", FIXTURES)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails.**

```bash
npm test -- agents
```

Expected: import error, 3 failures.

- [ ] **Step 4: Implement `lib/agents.ts`.**

```ts
// dashboard/lib/agents.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseAgentFrontmatter, AgentFrontmatter } from "@/lib/schemas";
import { AGENTS_DIR } from "@/lib/paths";

export interface Agent extends AgentFrontmatter {
  filePath: string;
  systemPrompt: string;   // body markdown without the "# System Prompt" heading
  lastModified: number;
}

function stripSystemPromptHeading(body: string): string {
  return body.replace(/^#\s*System Prompt\s*\n+/i, "").trim();
}

export function parseAgentFile(filePath: string): Agent {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parseAgentFrontmatter(parsed.data);
  const stat = fs.statSync(filePath);
  return {
    ...fm,
    filePath,
    systemPrompt: stripSystemPromptHeading(parsed.content),
    lastModified: stat.mtimeMs,
  };
}

export function listAgents(rootDir: string = AGENTS_DIR): Agent[] {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const agents: Agent[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === "README.md" || entry.name === "CLAUDE.md") continue;
    try {
      agents.push(parseAgentFile(path.join(rootDir, entry.name)));
    } catch (err) {
      console.warn(`[agents] skipping ${entry.name}: ${(err as Error).message}`);
    }
  }
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgent(slug: string, rootDir: string = AGENTS_DIR): Agent | null {
  const candidates = [
    path.join(rootDir, `${slug}.md`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return parseAgentFile(c);
      } catch {
        return null;
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes.**

```bash
npm test -- agents
```

Expected: 3 passing.

- [ ] **Step 6: Commit.**

```bash
git add dashboard/lib/agents.ts dashboard/tests/agents.test.ts dashboard/tests/fixtures/agents/
git commit -m "feat(dashboard): agents loader reads flat agents/<slug>.md"
```

---

## Task 6: Database module

**Files:**
- Create: `dashboard/lib/db.ts`, `dashboard/tests/db.test.ts`

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/db.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getMigrationVersion, closeDb } from "@/lib/db";

let dbPath: string;

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-db-"));
  dbPath = path.join(tmp, "state.db");
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(dbPath)) {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  }
});

describe("db", () => {
  it("creates the schema on first open", () => {
    const db = openDb(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain("issues");
    expect(names).toContain("runs");
    expect(names).toContain("hook_events");
    expect(names).toContain("settings_kv");
    expect(names).toContain("schema_migrations");
  });

  it("records the initial migration version", () => {
    openDb(dbPath);
    expect(getMigrationVersion()).toBe(1);
  });

  it("is idempotent on second open", () => {
    openDb(dbPath);
    closeDb();
    const db2 = openDb(dbPath);
    const count = (db2.prepare("SELECT COUNT(*) as n FROM schema_migrations").get() as { n: number }).n;
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- db
```

Expected: module not found.

- [ ] **Step 3: Implement `lib/db.ts`.**

```ts
// dashboard/lib/db.ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { STATE_DB_PATH } from "@/lib/paths";

let db: Database.Database | null = null;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug    TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  assignee_slug   TEXT,
  status          TEXT NOT NULL DEFAULT 'backlog',
  mode            TEXT NOT NULL DEFAULT 'async',
  priority        INTEGER NOT NULL DEFAULT 0,
  labels          TEXT,
  github_url      TEXT,
  github_number   INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS issues_project_idx ON issues(project_slug, status);

CREATE TABLE IF NOT EXISTS runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id        INTEGER NOT NULL,
  agent_slug      TEXT NOT NULL,
  runtime_id      TEXT NOT NULL,
  worktree_path   TEXT NOT NULL,
  pty_session_id  TEXT,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  exit_status     TEXT,
  transcript_path TEXT,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);
CREATE INDEX IF NOT EXISTS runs_issue_idx ON runs(issue_id, started_at DESC);

CREATE TABLE IF NOT EXISTS hook_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER,
  session_id      TEXT,
  event_type      TEXT NOT NULL,
  payload         TEXT NOT NULL,
  received_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_at      INTEGER NOT NULL
);
`;

export function openDb(dbPath: string = STATE_DB_PATH): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_V1);
  const row = db.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 1").get() as { n: number };
  if (row.n === 0) {
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)").run(Date.now());
  }
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("DB not opened; call openDb() first");
  return db;
}

export function getMigrationVersion(): number {
  const d = getDb();
  const row = d.prepare("SELECT MAX(version) as v FROM schema_migrations").get() as { v: number | null };
  return row.v ?? 0;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- db
```

Expected: 3 passing.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/lib/db.ts dashboard/tests/db.test.ts
git commit -m "feat(dashboard): sqlite db module with v1 schema"
```

---

## Task 7: Migration script

**Files:**
- Create: `dashboard/scripts/migrate-to-0002.ts`, `dashboard/tests/migrate.test.ts`

- [ ] **Step 1: Sketch the department-to-skills map.**

This map is used only by the migration script. It is intentionally simple and conservative; the operator can edit `agents/<slug>.md` afterwards to refine skill tags.

| Old `department:` value | New `skills:` value |
|---|---|
| research | ["research"] |
| coding | ["coding"] |
| content | ["writing"] |
| business | ["business"] |
| productivity | ["productivity"] |

For agents that already have a `capabilities:` or similar tag list in frontmatter, those tags get merged into `skills:` in addition to the department mapping. Duplicates are deduped.

- [ ] **Step 2: Write the failing test.**

`dashboard/tests/migrate.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import { runMigration } from "@/scripts/migrate-to-0002";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-migrate-"));
  process.env.AGENTIC_OS_REPO_ROOT = WORK;
});

afterEach(() => {
  fs.rmSync(WORK, { recursive: true, force: true });
  delete process.env.AGENTIC_OS_REPO_ROOT;
});

function writeFile(rel: string, contents: string) {
  const full = path.join(WORK, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(WORK, rel), "utf8");
}

describe("migrate-to-0002", () => {
  it("flattens agents/<dept>/<name>.md to agents/<slug>.md and adds skills", () => {
    writeFile("agents/research/lit-reviewer.md", `---
name: Literature Reviewer
department: research
created: 2026-01-01
---

# System Prompt
Body.
`);
    runMigration();
    expect(fs.existsSync(path.join(WORK, "agents/lit-reviewer.md"))).toBe(true);
    expect(fs.existsSync(path.join(WORK, "agents/research/lit-reviewer.md"))).toBe(false);
    const parsed = matter(readFile("agents/lit-reviewer.md"));
    expect(parsed.data.skills).toEqual(["research"]);
    expect(parsed.data.runtime).toBe("claude-code");
    expect(parsed.data.department).toBeUndefined();
  });

  it("adds crew, runtime-default, capabilities to PROJECT.md if absent", () => {
    writeFile("vault/projects/qml/PROJECT.md", `---
name: QML
slug: qml
path: /tmp/qml
created: 2026-01-01
---

# QML
`);
    runMigration();
    const parsed = matter(readFile("vault/projects/qml/PROJECT.md"));
    expect(parsed.data.crew).toEqual([]);
    expect(parsed.data["runtime-default"]).toBe("claude-code");
    expect(parsed.data.capabilities).toEqual([]);
  });

  it("is idempotent on second run", () => {
    writeFile("agents/research/lit-reviewer.md", `---
name: Literature Reviewer
department: research
created: 2026-01-01
---
body
`);
    runMigration();
    const after1 = readFile("agents/lit-reviewer.md");
    runMigration();
    const after2 = readFile("agents/lit-reviewer.md");
    expect(after2).toBe(after1);
  });

  it("writes a done marker", () => {
    runMigration();
    expect(fs.existsSync(path.join(WORK, ".agentic-os/migrations/0002.done"))).toBe(true);
  });

  it("refuses to overwrite if a flat agent file with same slug already exists", () => {
    writeFile("agents/lit-reviewer.md", `---
name: x
slug: lit-reviewer
runtime: claude-code
created: 2026-01-01
---
body
`);
    writeFile("agents/research/lit-reviewer.md", `---
name: y
department: research
created: 2026-01-01
---
body
`);
    expect(() => runMigration()).toThrow(/collision/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails.**

```bash
npm test -- migrate
```

Expected: import error, multiple failures.

- [ ] **Step 4: Implement the migration script.**

`dashboard/scripts/migrate-to-0002.ts`:
```ts
#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const DEPT_TO_SKILLS: Record<string, string[]> = {
  research: ["research"],
  coding: ["coding"],
  content: ["writing"],
  business: ["business"],
  productivity: ["productivity"],
};

const KNOWN_DEPT_DIRS = Object.keys(DEPT_TO_SKILLS);
const DONE_MARKER_REL = ".agentic-os/migrations/0002.done";

function repoRoot(): string {
  return process.env.AGENTIC_OS_REPO_ROOT ?? path.resolve(__dirname, "..", "..");
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function migrateAgents(root: string): { moved: number; skipped: number } {
  const agentsDir = path.join(root, "agents");
  if (!fs.existsSync(agentsDir)) return { moved: 0, skipped: 0 };

  let moved = 0;
  let skipped = 0;

  for (const dept of KNOWN_DEPT_DIRS) {
    const deptDir = path.join(agentsDir, dept);
    if (!fs.existsSync(deptDir) || !fs.statSync(deptDir).isDirectory()) continue;

    const files = fs.readdirSync(deptDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const oldPath = path.join(deptDir, file);
      const slug = path.basename(file, ".md");
      const newPath = path.join(agentsDir, file);

      if (fs.existsSync(newPath)) {
        throw new Error(`Migration collision: ${newPath} already exists. Resolve manually before retrying.`);
      }

      const raw = fs.readFileSync(oldPath, "utf8");
      const parsed = matter(raw);
      const data: Record<string, unknown> = { ...parsed.data };

      const existingSkills = Array.isArray(data.skills) ? (data.skills as string[]) : [];
      const existingCaps = Array.isArray(data.capabilities) ? (data.capabilities as string[]) : [];
      const deptSkills = DEPT_TO_SKILLS[dept] ?? [];
      data.skills = dedupe([...existingSkills, ...existingCaps, ...deptSkills]);

      if (!data.runtime) data.runtime = "claude-code";
      if (!data.slug) data.slug = slug;
      if (!data["allowed-tools"]) data["allowed-tools"] = [];
      delete data.department;
      delete data.capabilities;

      const newContent = matter.stringify(parsed.content, data);
      fs.writeFileSync(newPath, newContent);
      fs.unlinkSync(oldPath);
      moved += 1;
    }

    // Remove the dept directory if empty.
    const remaining = fs.readdirSync(deptDir);
    if (remaining.length === 0) {
      fs.rmdirSync(deptDir);
    }
  }

  // Also normalize already-flat agent files: ensure runtime, slug, skills fields are present.
  const flatFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md") && f !== "README.md");
  for (const file of flatFiles) {
    const fp = path.join(agentsDir, file);
    if (!fs.statSync(fp).isFile()) continue;
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = matter(raw);
    const data: Record<string, unknown> = { ...parsed.data };
    let touched = false;

    if (!data.slug) {
      data.slug = path.basename(file, ".md");
      touched = true;
    }
    if (!data.runtime) {
      data.runtime = "claude-code";
      touched = true;
    }
    if (!Array.isArray(data.skills)) {
      data.skills = [];
      touched = true;
    }
    if (!Array.isArray(data["allowed-tools"])) {
      data["allowed-tools"] = [];
      touched = true;
    }
    if (data.department !== undefined || data.capabilities !== undefined) {
      const existingSkills = Array.isArray(data.skills) ? (data.skills as string[]) : [];
      const existingCaps = Array.isArray(data.capabilities) ? (data.capabilities as string[]) : [];
      const dept = typeof data.department === "string" ? data.department : "";
      const deptSkills = DEPT_TO_SKILLS[dept] ?? [];
      data.skills = dedupe([...existingSkills, ...existingCaps, ...deptSkills]);
      delete data.department;
      delete data.capabilities;
      touched = true;
    }

    if (touched) {
      fs.writeFileSync(fp, matter.stringify(parsed.content, data));
    } else {
      skipped += 1;
    }
  }

  return { moved, skipped };
}

function migrateProjects(root: string): number {
  const projectsRoot = path.join(root, "vault", "projects");
  if (!fs.existsSync(projectsRoot)) return 0;

  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  let updated = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fp = path.join(projectsRoot, entry.name, "PROJECT.md");
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = matter(raw);
    const data: Record<string, unknown> = { ...parsed.data };
    let touched = false;
    if (!Array.isArray(data.crew)) {
      data.crew = [];
      touched = true;
    }
    if (!data["runtime-default"]) {
      data["runtime-default"] = "claude-code";
      touched = true;
    }
    if (!Array.isArray(data.capabilities)) {
      data.capabilities = [];
      touched = true;
    }
    if (touched) {
      fs.writeFileSync(fp, matter.stringify(parsed.content, data));
      updated += 1;
    }
  }
  return updated;
}

export function runMigration(): { agentsMoved: number; projectsUpdated: number } {
  const root = repoRoot();
  const doneMarker = path.join(root, DONE_MARKER_REL);
  if (fs.existsSync(doneMarker)) {
    // Idempotent: still run because operator may have added files since.
  }

  const agentsResult = migrateAgents(root);
  const projectsUpdated = migrateProjects(root);

  const markerDir = path.dirname(doneMarker);
  fs.mkdirSync(markerDir, { recursive: true });
  fs.writeFileSync(doneMarker, JSON.stringify({ ranAt: new Date().toISOString() }, null, 2));

  return { agentsMoved: agentsResult.moved, projectsUpdated };
}

// CLI entrypoint
if (require.main === module) {
  const result = runMigration();
  console.log(`Migration complete. Agents moved: ${result.agentsMoved}. Projects updated: ${result.projectsUpdated}.`);
}
```

- [ ] **Step 5: Run test to verify it passes.**

```bash
npm test -- migrate
```

Expected: 5 passing.

- [ ] **Step 6: Run the migration on the actual repo.**

From repo root, with a clean working tree:
```bash
cd dashboard
npm run migrate
```

Expected output: `Migration complete. Agents moved: N. Projects updated: M.`

Then verify by hand:
```bash
ls ../agents/                                # should be flat, no subdirs
cat ../vault/projects/<some-slug>/PROJECT.md # should have crew, runtime-default, capabilities
cat ../.agentic-os/migrations/0002.done      # exists
```

- [ ] **Step 7: Commit.**

```bash
cd ..
git add agents/ vault/projects/ .agentic-os/migrations/0002.done dashboard/scripts/ dashboard/tests/migrate.test.ts
git commit -m "feat(migration): apply Spec 0002 schema migration"
```

If the working tree is large, review the diff first:
```bash
git diff --stat HEAD
```

---

## Task 8: API routes for projects

**Files:**
- Create: `dashboard/app/api/projects/route.ts`, `dashboard/app/api/projects/[slug]/route.ts`

- [ ] **Step 1: Implement `GET /api/projects`.**

`dashboard/app/api/projects/route.ts`:
```ts
import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({
      projects: projects.map(p => ({
        slug: p.slug,
        name: p.name,
        path: p.path,
        repo: p.repo ?? null,
        crew: p.crew,
        capabilities: p.capabilities,
        runtimeDefault: p["runtime-default"],
        lastModified: p.lastModified,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Implement `GET /api/projects/[slug]`.**

`dashboard/app/api/projects/[slug]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getProject } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    slug: project.slug,
    name: project.name,
    path: project.path,
    repo: project.repo ?? null,
    crew: project.crew,
    capabilities: project.capabilities,
    runtimeDefault: project["runtime-default"],
    bodyMarkdown: project.bodyMarkdown,
    lastModified: project.lastModified,
  });
}
```

- [ ] **Step 3: Smoke-test the routes.**

Start the dev server:
```bash
npm run dev
```

In another shell:
```bash
curl -s http://localhost:3000/api/projects | head -c 500
curl -s http://localhost:3000/api/projects/<some-slug> | head -c 500
```

Expected: JSON response with a `projects` array (or a single project), pulled from your real `vault/projects/`. The `<some-slug>` should be one you saw in the listing.

Stop the dev server with Ctrl-C.

- [ ] **Step 4: Commit.**

```bash
git add dashboard/app/api/
git commit -m "feat(dashboard): GET /api/projects and /api/projects/[slug]"
```

---

## Task 9: Home page with project list

**Files:**
- Create: `dashboard/components/home/ProjectCard.tsx`, `dashboard/components/home/RunningSessionsStrip.tsx`, `dashboard/components/common/EmptyState.tsx`
- Modify: `dashboard/app/page.tsx`

- [ ] **Step 1: Build the `ProjectCard` component.**

`dashboard/components/home/ProjectCard.tsx`:
```tsx
import Link from "next/link";

interface ProjectCardProps {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crewSize: number;
  capabilities: string[];
  lastModified: number;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ProjectCard({ slug, name, path, repo, crewSize, capabilities, lastModified }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${slug}`}
      className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={path}>{path}</p>
        </div>
        <span className="text-xs text-gray-400 ml-2 shrink-0">{formatRelative(lastModified)}</span>
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs">
        <span className="text-gray-500">
          Crew: <span className="font-medium text-gray-700 dark:text-gray-300">{crewSize}</span>
        </span>
        {repo && (
          <span className="text-gray-500 truncate" title={repo}>
            {new URL(repo).pathname.replace(/^\//, "")}
          </span>
        )}
      </div>
      {capabilities.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-3">
          {capabilities.slice(0, 5).map(c => (
            <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Build `RunningSessionsStrip` (empty stub).**

`dashboard/components/home/RunningSessionsStrip.tsx`:
```tsx
// Phase 1 stub. Phase 3 will populate this from the runs table.
export function RunningSessionsStrip() {
  return null;
}
```

- [ ] **Step 3: Build `EmptyState` component.**

`dashboard/components/common/EmptyState.tsx`:
```tsx
interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}
```

- [ ] **Step 4: Replace `app/page.tsx` with the real Home.**

`dashboard/app/page.tsx`:
```tsx
import { listProjects } from "@/lib/projects";
import { ProjectCard } from "@/components/home/ProjectCard";
import { RunningSessionsStrip } from "@/components/home/RunningSessionsStrip";
import { EmptyState } from "@/components/common/EmptyState";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = listProjects();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agentic OS</h1>
        <button className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:border-gray-500" disabled title="New Project flow ships in Phase 2">
          + New Project
        </button>
      </header>

      <RunningSessionsStrip />

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Projects</h2>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" description="Add a project via vault/projects/<slug>/PROJECT.md, then refresh." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map(p => (
              <ProjectCard
                key={p.slug}
                slug={p.slug}
                name={p.name}
                path={p.path}
                repo={p.repo ?? null}
                crewSize={p.crew.length}
                capabilities={p.capabilities}
                lastModified={p.lastModified}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Smoke-test the page.**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: a list of every migrated project. Each card shows name, truncated path, crew size (probably 0 since you haven't filled crews yet), and capability chips if present.

Click a project card. Expected: a 404 page (the project page route comes in Task 10).

- [ ] **Step 6: Commit.**

```bash
git add dashboard/app/page.tsx dashboard/components/
git commit -m "feat(dashboard): Home page lists projects from vault"
```

---

## Task 10: Stub project page

**Files:**
- Create: `dashboard/app/projects/[slug]/page.tsx`

- [ ] **Step 1: Implement the page.**

`dashboard/app/projects/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span>{project.slug}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-500 mt-1" title={project.path}>{project.path}</p>
        {project.repo && (
          <a href={project.repo} className="text-sm text-blue-600 hover:underline mt-1 inline-block" target="_blank" rel="noreferrer">
            {project.repo}
          </a>
        )}
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Crew</h2>
          {project.crew.length === 0 ? (
            <p className="text-sm text-gray-400">No crew yet. Crew editing ships in Phase 2.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {project.crew.map(slug => <li key={slug} className="font-mono">{slug}</li>)}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Capabilities</h2>
          {project.capabilities.length === 0 ? (
            <p className="text-sm text-gray-400">No capabilities tagged.</p>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {project.capabilities.map(c => (
                <span key={c} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-900">{c}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Kanban</h2>
        <p className="text-sm text-gray-400">Issues board ships in Phase 2.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Smoke-test the page.**

```bash
npm run dev
```

Click a project on Home. Expected: project page renders with name, path, repo (if any), empty crew list, capability chips, and the "Issues board ships in Phase 2" stub.

- [ ] **Step 3: Commit.**

```bash
git add dashboard/app/projects/
git commit -m "feat(dashboard): stub project page with metadata"
```

---

## Task 11: Filesystem watcher

**Files:**
- Create: `dashboard/lib/watcher.ts`, `dashboard/tests/watcher.test.ts`

This is the only piece that's stateful at the module level in Phase 1. The watcher invalidates an in-memory cache of projects/agents when their files change, so the dashboard reflects edits made in Obsidian or any text editor without a server restart.

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/watcher.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startWatcher, stopWatcher, getEventCount, resetWatcherForTesting } from "@/lib/watcher";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-watcher-"));
  resetWatcherForTesting();
});

afterEach(async () => {
  await stopWatcher();
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("watcher", () => {
  it("detects PROJECT.md additions under vault/projects", async () => {
    fs.mkdirSync(path.join(WORK, "vault", "projects"), { recursive: true });
    await startWatcher({
      projectsRoot: path.join(WORK, "vault", "projects"),
      agentsRoot: path.join(WORK, "agents"),
    });

    fs.mkdirSync(path.join(WORK, "vault", "projects", "new-proj"), { recursive: true });
    fs.writeFileSync(path.join(WORK, "vault", "projects", "new-proj", "PROJECT.md"), `---
name: New Proj
slug: new-proj
path: /tmp
created: 2026-01-01
---
body
`);

    await new Promise(r => setTimeout(r, 400));
    expect(getEventCount("project")).toBeGreaterThan(0);
  });

  it("detects agent file changes", async () => {
    fs.mkdirSync(path.join(WORK, "agents"), { recursive: true });
    fs.mkdirSync(path.join(WORK, "vault", "projects"), { recursive: true });
    await startWatcher({
      projectsRoot: path.join(WORK, "vault", "projects"),
      agentsRoot: path.join(WORK, "agents"),
    });

    fs.writeFileSync(path.join(WORK, "agents", "new-agent.md"), `---
name: a
slug: new-agent
runtime: claude-code
created: 2026-01-01
---
body
`);

    await new Promise(r => setTimeout(r, 400));
    expect(getEventCount("agent")).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- watcher
```

Expected: import error.

- [ ] **Step 3: Implement `lib/watcher.ts`.**

```ts
// dashboard/lib/watcher.ts
import chokidar, { FSWatcher } from "chokidar";
import { VAULT_PROJECTS_DIR, AGENTS_DIR } from "@/lib/paths";

interface StartOptions {
  projectsRoot?: string;
  agentsRoot?: string;
}

let watcher: FSWatcher | null = null;
const counts: Record<string, number> = { project: 0, agent: 0 };

export async function startWatcher(opts: StartOptions = {}): Promise<void> {
  if (watcher) return;

  const projectsRoot = opts.projectsRoot ?? VAULT_PROJECTS_DIR;
  const agentsRoot = opts.agentsRoot ?? AGENTS_DIR;

  watcher = chokidar.watch(
    [
      `${projectsRoot}/*/PROJECT.md`,
      `${agentsRoot}/*.md`,
    ],
    {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
    }
  );

  watcher.on("all", (event, filePath) => {
    if (filePath.includes("/agents/") || filePath.includes("\\agents\\")) {
      counts.agent += 1;
    } else if (filePath.includes("PROJECT.md")) {
      counts.project += 1;
    }
    // Phase 1 just counts. Phase 2 will fan out to clients via SSE.
  });

  // Wait for ready event so tests can rely on the watcher being live.
  await new Promise<void>(resolve => {
    watcher!.on("ready", () => resolve());
  });
}

export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}

export function getEventCount(kind: "project" | "agent"): number {
  return counts[kind] ?? 0;
}

export function resetWatcherForTesting() {
  counts.project = 0;
  counts.agent = 0;
}
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- watcher
```

Expected: 2 passing. If flaky on first run due to filesystem timing, increase the `setTimeout` in tests from 400ms to 800ms.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/lib/watcher.ts dashboard/tests/watcher.test.ts
git commit -m "feat(dashboard): chokidar watcher for projects and agents"
```

The watcher is wired into the server lifecycle in Phase 2 when the dashboard starts reacting to changes (cache invalidation, SSE push). Phase 1 just establishes that the abstraction works.

---

## Task 12: Phase verification

**Files:** none modified.

- [ ] **Step 1: Run all tests.**

```bash
cd dashboard
npm test
```

Expected: all tests pass across `schemas`, `settings`, `projects`, `agents`, `db`, `migrate`, `watcher`.

- [ ] **Step 2: Boot the dashboard fresh.**

```bash
npm run dev
```

Expected: server boots without errors, no warnings about missing modules or schema mismatches.

- [ ] **Step 3: Manually verify the phase definition of done.**

Walk the Phase 1 acceptance criteria from the spec (paraphrased):

1. Open `http://localhost:3000`. Home page lists migrated projects.
2. Each project card shows name, truncated path, crew size, capability chips, relative timestamp.
3. Click into a project. Stub project page renders correctly.
4. Click the disabled "+ New Project" button. Tooltip says "ships in Phase 2."
5. Edit one PROJECT.md frontmatter from your editor (change capabilities or name). Reload Home. Change is reflected.

Note: in Phase 1 the change shows up only because `dynamic = "force-dynamic"` makes Next.js re-render the page on every request. Real cache invalidation through the watcher comes in Phase 2.

- [ ] **Step 4: Run the QML dogfood checkpoint.**

Find the QML healthcare diagnostics project (or whichever is your most-active research project) in the project list. Confirm:
- Name is correct.
- Path matches the actual working tree on disk.
- Capabilities are sensible (probably empty after migration, which is fine).
- Crew is empty.

This is the Phase 1 dogfood: you can see the project, you cannot yet run an issue against it. Phase 2 unlocks that.

- [ ] **Step 5: Commit a phase tag.**

```bash
cd ..
git tag -a path-a-phase-1 -m "Path A reset Phase 1: data model, migration, read-only Home"
```

Phase 1 is done. Move to Phase 2 via a new plan document at `docs/plans/<date>-path-a-reset-phase-2.md`.

---

## Self-review

Spec coverage check, walking Spec 0002 acceptance criteria:

- A1 (fresh clone, dev boots, Home lists projects): covered by Tasks 1, 9.
- A2 (clone from GitHub): out of scope for Phase 1, in Phase 2.
- A3 (link existing folder): out of scope for Phase 1, in Phase 2.
- A4-A6 (kanban, issue, run): Phase 2 and 3.
- A7 (parallel issues with worktrees): Phase 3.
- A8 (hooks): Phase 5.
- A9 (open in terminal): Phase 3.
- A10 (settings page): Phase 6. Settings module itself is here in Task 2.
- A11 (migration script idempotent and complete): covered by Task 7 with explicit idempotency test.
- A12 (removed lib modules and routes): naturally satisfied since the new `dashboard/` is fresh. Verify by running `find dashboard -name router.ts -o -name teams.ts -o -name claude-headless.ts` and confirming zero hits at the end of Phase 1.
- A13 (QML dogfood): covered by Task 12 Step 4.

Placeholder scan: every code step contains real, complete code. No "implement later" or "similar to above" references. The two stubbed components (RunningSessionsStrip empty, ProjectCard's "+ New Project" button disabled) are intentional and explicitly noted as Phase 2 territory.

Type consistency check: `Project` interface in `lib/projects.ts` extends `ProjectFrontmatter` from `lib/schemas.ts`. `Agent` interface in `lib/agents.ts` extends `AgentFrontmatter`. The API route in Task 8 reshapes both into a flat JSON object (camelCased `runtimeDefault` instead of kebab-case `runtime-default`) which the UI consumes. The Home page in Task 9 reads from `listProjects()` directly (server component), not from the API, so the camelCase reshape only matters when the UI gets a separate API consumer in Phase 2.

Known gaps to address in Phase 2 immediately, so they aren't a surprise:

1. The Home page uses `dynamic = "force-dynamic"` for cheap "see your edits" behavior. Phase 2 should switch to a real revalidate strategy backed by the watcher.
2. The watcher is implemented but not consumed. Phase 2 wires it to a Next.js server-only singleton.
3. The migration script's department-to-skills mapping is intentionally coarse. After running it on your real repo, hand-edit a few agent files to give them better skill tags before Phase 4's crew picker becomes useful.

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-05-20-path-a-reset-phase-1.md`. Two execution options:

1. Subagent-driven: dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.
2. Inline execution: execute tasks in this session via `superpowers:executing-plans`, batch with checkpoints for review.

Pick one. For your setup (Claude Code daily, Cursor on the side, working from phone between shifts), option 2 is probably the right default. You can do this whole phase in a single Claude Code session pinned to the repo root, with checkpoint reviews after Tasks 1, 7, and 12. Subagents are more useful when each task has heavy parallelizable work; this phase has tight dependencies between tasks, so a linear run is fine.
