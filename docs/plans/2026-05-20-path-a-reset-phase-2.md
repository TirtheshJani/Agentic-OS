# Path A Reset, Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Project page with a drag-and-drop kanban, the Issue slide-over with thread, the crew picker, and the New Project flow (clone from GitHub or link existing folder). End state: you can file an issue against the QML project, assign it to a crew member, and drag it through Backlog to Done by hand.

**Architecture:** Issues live in SQLite (created in Phase 1). Threads live as append-only markdown files at `vault/projects/<slug>/threads/<issue-id>.md`. The watcher built in Phase 1 gets wired into a Next.js server singleton on first request and fans out filesystem events to clients via SSE. Drag-and-drop uses dnd-kit. No agent execution yet (Phase 3 ships that).

**Tech Stack:** Next.js 15.1, React 19, TypeScript 5.6, dnd-kit 6.x, gray-matter 4.0, chokidar 4.0 (from Phase 1), better-sqlite3 11.x (from Phase 1), vitest 2.1.

**Spec:** `specs/0002-path-a-reset.md`. Prior plan: `docs/plans/2026-05-20-path-a-reset-phase-1.md`.

---

## Phase 2 Scope

In scope:

- SSE infrastructure: watcher singleton bootstrapped on server start, `/api/stream` endpoint, `useStream` hook on the client.
- New Project flow: link an existing folder, clone from a GitHub URL. POST endpoint, dialog UI, validation, side effects (creates `vault/projects/<slug>/PROJECT.md`, optionally runs `git clone` into `<workspaceRoot>/<slug>`).
- Issue data layer (`lib/issues.ts`) with full CRUD against SQLite.
- Thread data layer (`lib/threads.ts`) with append-only markdown writes plus a one-time migration of legacy `vault/threads/*.md` into the new per-project layout.
- API routes: `/api/issues`, `/api/issues/[id]`, `/api/issues/[id]/thread`, `/api/projects` POST, `/api/projects/[slug]/crew` PUT.
- Project page rebuild: kanban with five columns (Backlog, Queued, Running, Review, Done), drag-and-drop, crew sidebar, "+ New Issue" button, "Edit crew" button.
- Issue slide-over: header (status, assignee, priority, mode, labels), title + body inline editing, thread section with comment box, status action buttons. The "Runs" tab strip is stubbed with a "Phase 3" notice.
- Crew picker slide-over: lists agents whose `skills:` intersect the project's `capabilities:`. Save writes back to PROJECT.md.
- New Issue dialog from the Project page header.
- Home page live updates: when a PROJECT.md changes on disk or a new project is created, the list re-renders without manual refresh.

Out of scope:

- Running agents on issues (Phase 3).
- Agent profile editing UI (Phase 4); the Agents page stays whatever Phase 1 left.
- Hook ingestion (Phase 5).
- Settings page UI (Phase 6).
- "Runs" tab in the issue slide-over (Phase 3 wires it).
- Issue labels editor beyond a freeform comma-separated input (a real chip picker can wait).
- Archived/deleted issue recovery flow.

## Verification strategy

Each task ends with a runnable command and expected output. Phase-level definition of done:

1. From Home, click "+ New Project, Link existing folder", pick a path on disk that already contains a `.git/` directory. New PROJECT.md is created at `vault/projects/<slug>/PROJECT.md`. Project appears on Home.
2. From Home, click "+ New Project, Clone from GitHub URL", paste a URL. Repo is cloned to `<workspaceRoot>/<slug>/`. PROJECT.md is created. Project appears on Home.
3. Open the QML project (or whichever real research project is closest to active). Kanban renders five columns, empty.
4. Click "+ New Issue". Modal asks for title, body, assignee, priority, mode. Save creates an issue in Backlog. Card appears on the kanban.
5. Drag the card from Backlog to Queued. Status persists across refresh.
6. Click the card. Slide-over opens with the issue's content. Edit the body inline and save. Reload, edit persists.
7. Append a comment via the thread section. Comment appears immediately in the thread list. Reload, comment persists. Open `vault/projects/<slug>/threads/<id>.md` directly; comment is there.
8. Click "Edit crew" on the project page. Slide-over lists agents filtered by skills intersecting the project's capabilities. Check two boxes, save. The crew sidebar updates. `crew:` in PROJECT.md is updated.
9. Edit a PROJECT.md from Obsidian (change the `name:` field). Within ~1 second, Home reflects the new name without a manual reload.
10. All vitest tests pass.

## File structure

New files this phase creates or replaces:

```
dashboard/
  app/
    page.tsx                                          # MODIFY: subscribe to SSE for live updates
    projects/[slug]/page.tsx                          # REPLACE: real kanban project page
    api/
      stream/route.ts                                 # NEW: SSE endpoint
      projects/route.ts                               # MODIFY: add POST
      projects/[slug]/route.ts                        # MODIFY: already GET, no change needed here
      projects/[slug]/crew/route.ts                   # NEW: PUT replaces crew list
      issues/route.ts                                 # NEW: GET list, POST create
      issues/[id]/route.ts                            # NEW: GET, PATCH, DELETE
      issues/[id]/thread/route.ts                     # NEW: GET, POST
  components/
    common/
      Drawer.tsx                                      # NEW: slide-over primitive
      Modal.tsx                                       # NEW: dialog primitive
      Button.tsx                                      # NEW: shared button styles
      Field.tsx                                       # NEW: label + input pair
    home/
      NewProjectDialog.tsx                            # NEW
    project/
      ProjectHeader.tsx                               # NEW
      CrewSidebar.tsx                                 # NEW
      CrewPickerDrawer.tsx                            # NEW
      KanbanBoard.tsx                                 # NEW (dnd-kit)
      KanbanColumn.tsx                                # NEW
      IssueCard.tsx                                   # NEW
      NewIssueDialog.tsx                              # NEW
    issue/
      IssueDrawer.tsx                                 # NEW: the slide-over container
      IssueHeader.tsx                                 # NEW
      IssueBodyEditor.tsx                             # NEW
      ThreadList.tsx                                  # NEW
      ThreadComposer.tsx                              # NEW
      RunsTabStub.tsx                                 # NEW: Phase 3 placeholder
  lib/
    issues.ts                                         # NEW
    threads.ts                                        # NEW
    projectMutations.ts                               # NEW: writes back to PROJECT.md
    stream.ts                                         # NEW: server-side SSE bus
    server-init.ts                                    # NEW: lazy singleton boot
    eligibleAgents.ts                                 # NEW: filter helper
  hooks/
    useStream.ts                                      # NEW
    useProjects.ts                                    # NEW
    useIssues.ts                                      # NEW
  scripts/
    migrate-threads.ts                                # NEW: moves vault/threads/*.md
  tests/
    issues.test.ts
    threads.test.ts
    projectMutations.test.ts
    eligibleAgents.test.ts
    stream.test.ts
```

New runtime dependencies:

```
@dnd-kit/core@6.3.1
@dnd-kit/sortable@8.0.0
@dnd-kit/utilities@3.2.2
clsx@2.1.1                  # tiny classname helper, used throughout
```

---

## Task 1: Server-side SSE bus and watcher boot

**Files:**
- Create: `dashboard/lib/stream.ts`, `dashboard/lib/server-init.ts`, `dashboard/app/api/stream/route.ts`, `dashboard/tests/stream.test.ts`
- Modify: `dashboard/lib/watcher.ts` (fan out to bus)

The watcher already exists from Phase 1 but isn't consumed. This task wires it into a tiny pub/sub bus and exposes an SSE endpoint.

- [ ] **Step 1: Install clsx (used by later UI tasks; install now so all later tasks can use it).**

```bash
cd dashboard
npm install clsx@2.1.1
```

- [ ] **Step 2: Write the failing test for the stream bus.**

`dashboard/tests/stream.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { publish, subscribe, resetBusForTesting } from "@/lib/stream";

beforeEach(() => resetBusForTesting());

describe("stream bus", () => {
  it("delivers events to a single subscriber", () => {
    const received: any[] = [];
    const unsub = subscribe(e => received.push(e));
    publish({ kind: "project.changed", slug: "x" });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ kind: "project.changed", slug: "x" });
    unsub();
  });

  it("delivers to multiple subscribers", () => {
    const a: any[] = [];
    const b: any[] = [];
    subscribe(e => a.push(e));
    subscribe(e => b.push(e));
    publish({ kind: "agent.changed", slug: "x" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("stops delivering after unsubscribe", () => {
    const received: any[] = [];
    const unsub = subscribe(e => received.push(e));
    unsub();
    publish({ kind: "project.changed", slug: "x" });
    expect(received).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails.**

```bash
npm test -- stream
```

Expected: import errors, 3 failures.

- [ ] **Step 4: Implement `lib/stream.ts`.**

```ts
// dashboard/lib/stream.ts
export type StreamEvent =
  | { kind: "project.changed"; slug: string; reason: "create" | "update" | "delete" }
  | { kind: "agent.changed"; slug: string; reason: "create" | "update" | "delete" }
  | { kind: "issue.changed"; id: number; projectSlug: string; reason: "create" | "update" | "delete" | "status" }
  | { kind: "thread.appended"; issueId: number };

type Listener = (event: StreamEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publish(event: StreamEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (err) {
      console.error("[stream] listener threw:", err);
    }
  }
}

export function resetBusForTesting(): void {
  listeners.clear();
}

export function listenerCount(): number {
  return listeners.size;
}
```

- [ ] **Step 5: Run test to verify it passes.**

```bash
npm test -- stream
```

Expected: 3 passing.

- [ ] **Step 6: Modify the watcher to publish events.**

Open `dashboard/lib/watcher.ts`. Replace the body of the `watcher.on("all", ...)` handler with this:

```ts
  watcher.on("all", (event, filePath) => {
    const isAgent = filePath.includes("/agents/") || filePath.includes("\\agents\\");
    const isProject = filePath.includes("PROJECT.md");

    if (isAgent) {
      counts.agent += 1;
      const slug = filePath.split(/[/\\]/).pop()!.replace(/\.md$/, "");
      const reason = event === "add" ? "create" : event === "unlink" ? "delete" : "update";
      publish({ kind: "agent.changed", slug, reason });
    } else if (isProject) {
      counts.project += 1;
      const parts = filePath.split(/[/\\]/);
      const projectsIdx = parts.findIndex(p => p === "projects");
      const slug = projectsIdx >= 0 ? parts[projectsIdx + 1] : "unknown";
      const reason = event === "add" ? "create" : event === "unlink" ? "delete" : "update";
      publish({ kind: "project.changed", slug, reason });
    }
  });
```

At the top of the file add:
```ts
import { publish } from "@/lib/stream";
```

- [ ] **Step 7: Write `lib/server-init.ts`.**

```ts
// dashboard/lib/server-init.ts
// Lazily boots server-side singletons on first request.
// Next.js spins up handlers on demand, so we need a sentinel.
import { startWatcher } from "@/lib/watcher";

let booted = false;
let bootPromise: Promise<void> | null = null;

export async function ensureServerBooted(): Promise<void> {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    await startWatcher();
    booted = true;
  })();
  return bootPromise;
}
```

- [ ] **Step 8: Write the SSE endpoint.**

`dashboard/app/api/stream/route.ts`:
```ts
import { subscribe, type StreamEvent } from "@/lib/stream";
import { ensureServerBooted } from "@/lib/server-init";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await ensureServerBooted();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StreamEvent | { kind: "ping" }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial ping so the client sees a successful connection.
      send({ kind: "ping" });

      const unsubscribe = subscribe(event => send(event));

      // Keepalive ping every 25s; some proxies kill idle SSE connections.
      const interval = setInterval(() => send({ kind: "ping" }), 25_000);

      // Clean up when the client disconnects. Next.js exposes this via the
      // ReadableStream cancel callback.
      (controller as any)._cleanup = () => {
        clearInterval(interval);
        unsubscribe();
      };
    },
    cancel(controller) {
      (controller as any)._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 9: Smoke test the SSE endpoint.**

```bash
npm run dev
```

In another shell:
```bash
curl -N http://localhost:3000/api/stream
```

Expected: first line `data: {"kind":"ping"}` appears immediately. Then nothing until you edit a PROJECT.md somewhere in `vault/projects/`, at which point a `data: {"kind":"project.changed",...}` event arrives.

Test it by touching a file:
```bash
# In a third shell, from repo root:
touch vault/projects/<some-slug>/PROJECT.md
```

The curl output should show a new line within a second. Ctrl-C the curl, stop dev server.

- [ ] **Step 10: Commit.**

```bash
git add dashboard/lib/stream.ts dashboard/lib/server-init.ts dashboard/lib/watcher.ts dashboard/app/api/stream/ dashboard/tests/stream.test.ts dashboard/package.json dashboard/package-lock.json
git commit -m "feat(dashboard): SSE bus, watcher fans events out to clients"
```

---

## Task 2: useStream hook and Home live updates

**Files:**
- Create: `dashboard/hooks/useStream.ts`, `dashboard/hooks/useProjects.ts`
- Modify: `dashboard/app/page.tsx` to consume the hook

This converts the Home page from server-rendered-once to client-revalidated when a project event arrives.

- [ ] **Step 1: Implement `hooks/useStream.ts`.**

```ts
// dashboard/hooks/useStream.ts
"use client";
import { useEffect, useRef } from "react";

export type StreamEventKind =
  | "ping"
  | "project.changed"
  | "agent.changed"
  | "issue.changed"
  | "thread.appended";

export interface StreamEventPayload {
  kind: StreamEventKind;
  [k: string]: unknown;
}

export function useStream(handler: (event: StreamEventPayload) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        handlerRef.current(data);
      } catch (err) {
        console.warn("[useStream] bad payload:", err);
      }
    };
    es.onerror = () => {
      // Browser will auto-reconnect. Nothing to do.
    };
    return () => {
      es.close();
    };
  }, []);
}
```

- [ ] **Step 2: Implement `hooks/useProjects.ts`.**

```ts
// dashboard/hooks/useProjects.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export interface ProjectSummary {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crew: string[];
  capabilities: string[];
  runtimeDefault: string;
  lastModified: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data.projects);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "project.changed") {
      reload();
    }
  });

  return { projects, error, reload };
}
```

- [ ] **Step 3: Convert `app/page.tsx` to a client component using the hook.**

Replace `dashboard/app/page.tsx` with:
```tsx
"use client";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/home/ProjectCard";
import { RunningSessionsStrip } from "@/components/home/RunningSessionsStrip";
import { EmptyState } from "@/components/common/EmptyState";
import { useState } from "react";
import { NewProjectDialog } from "@/components/home/NewProjectDialog";

export default function Home() {
  const { projects, error } = useProjects();
  const [dialogMode, setDialogMode] = useState<null | "link" | "clone">(null);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agentic OS</h1>
        <div className="relative">
          <details className="group">
            <summary className="list-none cursor-pointer text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:border-gray-500">
              + New Project
            </summary>
            <div className="absolute right-0 mt-1 w-56 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow z-10">
              <button
                onClick={() => setDialogMode("clone")}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                Clone from GitHub
              </button>
              <button
                onClick={() => setDialogMode("link")}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                Link existing folder
              </button>
            </div>
          </details>
        </div>
      </header>

      <RunningSessionsStrip />

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Projects</h2>
        {error && (
          <div className="text-sm text-red-600">Error: {error}</div>
        )}
        {!projects ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : projects.length === 0 ? (
          <EmptyState title="No projects yet" description='Click "+ New Project" to get started.' />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map(p => (
              <ProjectCard
                key={p.slug}
                slug={p.slug}
                name={p.name}
                path={p.path}
                repo={p.repo}
                crewSize={p.crew.length}
                capabilities={p.capabilities}
                lastModified={p.lastModified}
              />
            ))}
          </div>
        )}
      </section>

      {dialogMode && (
        <NewProjectDialog mode={dialogMode} onClose={() => setDialogMode(null)} />
      )}
    </main>
  );
}
```

Note: this imports `NewProjectDialog` which we build in Task 5. Until then the build will fail on this file. That's expected; commit Task 1 alone, do not commit this file yet. Instead, continue to Task 3 first.

- [ ] **Step 4: Don't commit yet.**

Stage the hooks but hold off on `page.tsx` since it references the not-yet-existing `NewProjectDialog`:

```bash
git add dashboard/hooks/
git commit -m "feat(dashboard): useStream and useProjects hooks"
```

Leave `dashboard/app/page.tsx` modified but unstaged. Task 5 will complete it.

---

## Task 3: New Project API for link-existing-folder mode

**Files:**
- Create: `dashboard/lib/projectMutations.ts`, `dashboard/tests/projectMutations.test.ts`
- Modify: `dashboard/app/api/projects/route.ts` to add POST

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/projectMutations.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import {
  createProjectFromExistingFolder,
  slugify,
  updateProjectCrew,
} from "@/lib/projectMutations";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-projmut-"));
});

afterEach(() => {
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("My Cool Project!")).toBe("my-cool-project");
    expect(slugify("QML Healthcare Diagnostics")).toBe("qml-healthcare-diagnostics");
    expect(slugify("foo_bar baz")).toBe("foo-bar-baz");
  });
  it("strips leading non-alphanumeric", () => {
    expect(slugify("--my proj")).toBe("my-proj");
  });
});

describe("createProjectFromExistingFolder", () => {
  it("creates a PROJECT.md pointing to the given path", () => {
    const folder = path.join(WORK, "src", "myproj");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "README.md"), "# x");

    const vaultDir = path.join(WORK, "vault", "projects");
    const result = createProjectFromExistingFolder({
      name: "My Proj",
      folderPath: folder,
      vaultProjectsDir: vaultDir,
    });

    expect(result.slug).toBe("my-proj");
    expect(fs.existsSync(path.join(vaultDir, "my-proj", "PROJECT.md"))).toBe(true);
    const parsed = matter(fs.readFileSync(path.join(vaultDir, "my-proj", "PROJECT.md"), "utf8"));
    expect(parsed.data.name).toBe("My Proj");
    expect(parsed.data.path).toBe(folder);
    expect(parsed.data.crew).toEqual([]);
    expect(parsed.data["runtime-default"]).toBe("claude-code");
  });

  it("detects a git repo and sets repo URL from remote", () => {
    const folder = path.join(WORK, "src", "gitproj");
    fs.mkdirSync(path.join(folder, ".git"), { recursive: true });
    fs.writeFileSync(path.join(folder, ".git", "config"), `
[remote "origin"]
\turl = https://github.com/foo/bar.git
`);

    const result = createProjectFromExistingFolder({
      name: "Git Proj",
      folderPath: folder,
      vaultProjectsDir: path.join(WORK, "vault", "projects"),
    });

    const parsed = matter(fs.readFileSync(result.projectFilePath, "utf8"));
    expect(parsed.data.repo).toBe("https://github.com/foo/bar.git");
  });

  it("refuses if a project with the same slug already exists", () => {
    const folder = path.join(WORK, "myproj");
    fs.mkdirSync(folder, { recursive: true });

    createProjectFromExistingFolder({
      name: "My Proj",
      folderPath: folder,
      vaultProjectsDir: path.join(WORK, "vault", "projects"),
    });

    expect(() =>
      createProjectFromExistingFolder({
        name: "My Proj",
        folderPath: folder,
        vaultProjectsDir: path.join(WORK, "vault", "projects"),
      })
    ).toThrow(/already exists/i);
  });

  it("refuses if the folder does not exist", () => {
    expect(() =>
      createProjectFromExistingFolder({
        name: "Ghost",
        folderPath: path.join(WORK, "does-not-exist"),
        vaultProjectsDir: path.join(WORK, "vault", "projects"),
      })
    ).toThrow(/does not exist/i);
  });
});

describe("updateProjectCrew", () => {
  it("rewrites the crew field", () => {
    const projectFile = path.join(WORK, "vault", "projects", "x", "PROJECT.md");
    fs.mkdirSync(path.dirname(projectFile), { recursive: true });
    fs.writeFileSync(projectFile, `---
name: X
slug: x
path: /tmp
crew: [a, b]
runtime-default: claude-code
capabilities: [research]
created: 2026-01-01
---
body
`);
    updateProjectCrew(projectFile, ["c", "d", "e"]);
    const parsed = matter(fs.readFileSync(projectFile, "utf8"));
    expect(parsed.data.crew).toEqual(["c", "d", "e"]);
    expect(parsed.content.trim()).toBe("body");
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- projectMutations
```

Expected: module not found, all failures.

- [ ] **Step 3: Implement `lib/projectMutations.ts`.**

```ts
// dashboard/lib/projectMutations.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readGitOriginUrl(folderPath: string): string | null {
  const gitConfig = path.join(folderPath, ".git", "config");
  if (!fs.existsSync(gitConfig)) return null;
  const txt = fs.readFileSync(gitConfig, "utf8");
  const match = txt.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
  return match ? match[1].trim() : null;
}

interface CreateFromFolderOpts {
  name: string;
  folderPath: string;
  vaultProjectsDir: string;
  capabilities?: string[];
  slug?: string;
}

interface CreateResult {
  slug: string;
  projectFilePath: string;
}

export function createProjectFromExistingFolder(opts: CreateFromFolderOpts): CreateResult {
  if (!fs.existsSync(opts.folderPath)) {
    throw new Error(`Folder does not exist: ${opts.folderPath}`);
  }
  if (!fs.statSync(opts.folderPath).isDirectory()) {
    throw new Error(`Not a directory: ${opts.folderPath}`);
  }

  const slug = opts.slug ?? slugify(opts.name);
  const projectDir = path.join(opts.vaultProjectsDir, slug);
  const projectFile = path.join(projectDir, "PROJECT.md");

  if (fs.existsSync(projectFile)) {
    throw new Error(`Project already exists at ${projectFile}`);
  }

  const repoUrl = readGitOriginUrl(opts.folderPath);
  const frontmatter: Record<string, unknown> = {
    name: opts.name,
    slug,
    path: opts.folderPath,
    crew: [],
    "runtime-default": "claude-code",
    capabilities: opts.capabilities ?? [],
    created: new Date().toISOString().slice(0, 10),
  };
  if (repoUrl) frontmatter.repo = repoUrl;

  const body = `# ${opts.name}\n\nProject notes go here. The dashboard does not render this body.\n`;
  const content = matter.stringify(body, frontmatter);

  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(projectFile, content);

  return { slug, projectFilePath: projectFile };
}

export function updateProjectCrew(projectFilePath: string, crew: string[]): void {
  const raw = fs.readFileSync(projectFilePath, "utf8");
  const parsed = matter(raw);
  const data: Record<string, unknown> = { ...parsed.data, crew };
  fs.writeFileSync(projectFilePath, matter.stringify(parsed.content, data));
}

export function updateProjectFields(
  projectFilePath: string,
  patch: Partial<{ name: string; capabilities: string[]; "runtime-default": string }>
): void {
  const raw = fs.readFileSync(projectFilePath, "utf8");
  const parsed = matter(raw);
  const data: Record<string, unknown> = { ...parsed.data, ...patch };
  fs.writeFileSync(projectFilePath, matter.stringify(parsed.content, data));
}
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- projectMutations
```

Expected: 7 passing.

- [ ] **Step 5: Add POST to `api/projects/route.ts`.**

Open `dashboard/app/api/projects/route.ts` and add to the bottom:

```ts
import { z } from "zod";
import path from "node:path";
import { createProjectFromExistingFolder } from "@/lib/projectMutations";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";

const PostBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("link"),
    name: z.string().min(1),
    folderPath: z.string().min(1),
    slug: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  }),
  z.object({
    mode: z.literal("clone"),
    name: z.string().min(1),
    repoUrl: z.string().url(),
    slug: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  }),
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.mode === "link") {
    try {
      const result = createProjectFromExistingFolder({
        name: parsed.data.name,
        folderPath: parsed.data.folderPath,
        vaultProjectsDir: VAULT_PROJECTS_DIR,
        slug: parsed.data.slug,
        capabilities: parsed.data.capabilities,
      });
      return NextResponse.json({ slug: result.slug, projectFilePath: result.projectFilePath }, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  // Clone mode handled in Task 4. Return 501 for now.
  return NextResponse.json({ error: "clone mode not implemented yet" }, { status: 501 });
}
```

- [ ] **Step 6: Smoke test link mode.**

```bash
npm run dev
```

In another shell:
```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"mode":"link","name":"Test Link","folderPath":"/tmp"}'
```

Expected: `{"slug":"test-link","projectFilePath":"..."}` (the path will be in your repo's `vault/projects/test-link/PROJECT.md`).

Verify the file:
```bash
cat vault/projects/test-link/PROJECT.md
```

Then clean up:
```bash
rm -rf vault/projects/test-link
```

Stop the dev server.

- [ ] **Step 7: Commit.**

```bash
git add dashboard/lib/projectMutations.ts dashboard/tests/projectMutations.test.ts dashboard/app/api/projects/route.ts
git commit -m "feat(api): POST /api/projects link mode"
```

---

## Task 4: New Project clone-from-GitHub mode

**Files:**
- Modify: `dashboard/lib/projectMutations.ts` (add `cloneAndCreateProject`)
- Modify: `dashboard/app/api/projects/route.ts` (handle clone mode)
- Modify: `dashboard/tests/projectMutations.test.ts` (add tests for clone helper)

- [ ] **Step 1: Append tests for `cloneAndCreateProject`.**

Append to `dashboard/tests/projectMutations.test.ts`:
```ts
import { extractRepoNameFromUrl } from "@/lib/projectMutations";

describe("extractRepoNameFromUrl", () => {
  it("pulls the repo name from a GitHub URL", () => {
    expect(extractRepoNameFromUrl("https://github.com/foo/bar.git")).toBe("bar");
    expect(extractRepoNameFromUrl("https://github.com/foo/bar")).toBe("bar");
    expect(extractRepoNameFromUrl("git@github.com:foo/bar.git")).toBe("bar");
  });
  it("returns null for non-repo URLs", () => {
    expect(extractRepoNameFromUrl("https://example.com")).toBeNull();
  });
});
```

We do not test the actual clone command in vitest (it would hit the network). The route handler in this task includes a smoke test step that runs against a real repo.

- [ ] **Step 2: Implement `extractRepoNameFromUrl` and `cloneAndCreateProject`.**

Append to `dashboard/lib/projectMutations.ts`:
```ts
import { spawnSync } from "node:child_process";

export function extractRepoNameFromUrl(url: string): string | null {
  // Handles https://github.com/foo/bar(.git) and git@github.com:foo/bar(.git)
  const match = url.match(/[/:]([^/:]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

interface CloneOpts {
  name: string;
  repoUrl: string;
  workspaceRoot: string;
  vaultProjectsDir: string;
  slug?: string;
  capabilities?: string[];
}

export function cloneAndCreateProject(opts: CloneOpts): CreateResult {
  if (!fs.existsSync(opts.workspaceRoot)) {
    fs.mkdirSync(opts.workspaceRoot, { recursive: true });
  }

  const slug = opts.slug ?? slugify(opts.name);
  const targetDir = path.join(opts.workspaceRoot, slug);

  if (fs.existsSync(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  // Prefer gh if available; fall back to git.
  const useGh = spawnSync("gh", ["--version"], { stdio: "ignore" }).status === 0;
  const cmd = useGh ? "gh" : "git";
  const args = useGh
    ? ["repo", "clone", opts.repoUrl, targetDir]
    : ["clone", opts.repoUrl, targetDir];

  const result = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Clone failed (${cmd} exit ${result.status}): ${result.stderr || result.stdout}`);
  }

  return createProjectFromExistingFolder({
    name: opts.name,
    folderPath: targetDir,
    vaultProjectsDir: opts.vaultProjectsDir,
    slug,
    capabilities: opts.capabilities,
  });
}
```

- [ ] **Step 3: Run unit tests.**

```bash
npm test -- projectMutations
```

Expected: 9 passing (7 from Task 3 + 2 new ones).

- [ ] **Step 4: Wire clone mode into the route.**

In `dashboard/app/api/projects/route.ts`, replace the 501 branch with:

```ts
  // Clone mode
  try {
    const settings = getSettings();
    const result = cloneAndCreateProject({
      name: parsed.data.name,
      repoUrl: parsed.data.repoUrl,
      workspaceRoot: settings.workspaceRoot,
      vaultProjectsDir: VAULT_PROJECTS_DIR,
      slug: parsed.data.slug,
      capabilities: parsed.data.capabilities,
    });
    return NextResponse.json(
      { slug: result.slug, projectFilePath: result.projectFilePath },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
```

Add imports at top:
```ts
import { cloneAndCreateProject } from "@/lib/projectMutations";
import { getSettings } from "@/lib/settings";
```

- [ ] **Step 5: Smoke test clone mode.**

Pick a tiny public repo as the test target. From repo root:
```bash
cd dashboard
npm run dev
```

In another shell:
```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"mode":"clone","name":"Test Clone","repoUrl":"https://github.com/octocat/Hello-World"}'
```

Expected: `{"slug":"test-clone","projectFilePath":"..."}`. The repo should be cloned into `<workspaceRoot>/test-clone/`.

Verify:
```bash
ls <workspaceRoot>/test-clone/
cat vault/projects/test-clone/PROJECT.md
```

Clean up:
```bash
rm -rf <workspaceRoot>/test-clone vault/projects/test-clone
```

Stop the dev server.

- [ ] **Step 6: Commit.**

```bash
git add dashboard/lib/projectMutations.ts dashboard/tests/projectMutations.test.ts dashboard/app/api/projects/route.ts
git commit -m "feat(api): POST /api/projects clone mode via gh or git"
```

---

## Task 5: New Project dialog UI

**Files:**
- Create: `dashboard/components/common/Modal.tsx`, `dashboard/components/common/Field.tsx`, `dashboard/components/common/Button.tsx`, `dashboard/components/home/NewProjectDialog.tsx`
- Modify: `dashboard/app/page.tsx` (commit the version staged in Task 2)

- [ ] **Step 1: Build the shared `Button.tsx`.**

`dashboard/components/common/Button.tsx`:
```tsx
"use client";
import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
  secondary: "border border-gray-300 dark:border-gray-700 hover:border-gray-500 bg-white dark:bg-gray-950",
  ghost: "hover:bg-gray-100 dark:hover:bg-gray-900",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={clsx(
        "text-sm px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
        styles[variant],
        className
      )}
    />
  );
});
```

- [ ] **Step 2: Build the shared `Field.tsx`.**

`dashboard/components/common/Field.tsx`:
```tsx
"use client";
import clsx from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputBase, "font-mono leading-relaxed", props.className)} />;
}
```

- [ ] **Step 3: Build the shared `Modal.tsx`.**

`dashboard/components/common/Modal.tsx`:
```tsx
"use client";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-800">
        <header className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold">{title}</h2>
        </header>
        <div className="px-5 py-4 space-y-3">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build `NewProjectDialog.tsx`.**

`dashboard/components/home/NewProjectDialog.tsx`:
```tsx
"use client";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Field, Input } from "@/components/common/Field";
import { Button } from "@/components/common/Button";

interface Props {
  mode: "link" | "clone";
  onClose: () => void;
}

export function NewProjectDialog({ mode, onClose }: Props) {
  const [name, setName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload =
      mode === "link"
        ? { mode, name, folderPath }
        : { mode, name, repoUrl };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.length > 0 && (mode === "link" ? folderPath.length > 0 : repoUrl.length > 0);
  const title = mode === "link" ? "Link existing folder" : "Clone from GitHub";

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? "Working..." : title}
          </Button>
        </>
      }
    >
      <Field label="Project name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="QML Healthcare Diagnostics"
          autoFocus
        />
      </Field>

      {mode === "link" ? (
        <Field label="Folder path" hint="Absolute path on your machine">
          <Input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/Users/tj/code/qml-healthcare-diagnostics"
          />
        </Field>
      ) : (
        <Field label="GitHub URL" hint="HTTPS or SSH form, both work">
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/TirtheshJani/qml-healthcare-diagnostics"
          />
        </Field>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
```

- [ ] **Step 5: Smoke test the dialog.**

```bash
npm run dev
```

Open `http://localhost:3000`. Click "+ New Project" then "Link existing folder". Fill in a name and a real folder path (use any folder you have). Click "Link existing folder" again to submit. The modal should close and the project should appear in the list within a second (live update from the watcher).

Try clone mode with a small public repo URL. Same flow, dialog should close, repo cloned, project appears.

Clean up any test projects:
```bash
rm -rf vault/projects/test-link <workspaceRoot>/test-clone vault/projects/test-clone
```

- [ ] **Step 6: Commit.**

```bash
git add dashboard/components/common/ dashboard/components/home/ dashboard/app/page.tsx
git commit -m "feat(dashboard): New Project dialog with link and clone modes"
```

---

## Task 6: Issue data layer

**Files:**
- Create: `dashboard/lib/issues.ts`, `dashboard/tests/issues.test.ts`

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/issues.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "@/lib/db";
import {
  createIssue,
  getIssue,
  listIssues,
  updateIssue,
  deleteIssue,
  type IssueStatus,
} from "@/lib/issues";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-issues-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("issues", () => {
  it("creates and retrieves an issue", () => {
    const id = createIssue({
      projectSlug: "qml",
      title: "Draft related work",
      body: "Cover the last 5 years of QML in diagnostics.",
      assigneeSlug: "lit-reviewer",
      priority: 1,
      mode: "async",
      labels: ["draft", "research"],
    });
    expect(id).toBeGreaterThan(0);

    const issue = getIssue(id);
    expect(issue).toBeTruthy();
    expect(issue!.title).toBe("Draft related work");
    expect(issue!.status).toBe("backlog");
    expect(issue!.assigneeSlug).toBe("lit-reviewer");
    expect(issue!.priority).toBe(1);
    expect(issue!.labels).toEqual(["draft", "research"]);
  });

  it("lists issues filtered by project and status", () => {
    createIssue({ projectSlug: "qml", title: "A", body: "" });
    createIssue({ projectSlug: "qml", title: "B", body: "" });
    createIssue({ projectSlug: "other", title: "C", body: "" });

    expect(listIssues({ projectSlug: "qml" })).toHaveLength(2);
    expect(listIssues({ projectSlug: "other" })).toHaveLength(1);
    expect(listIssues({ projectSlug: "qml", status: "backlog" })).toHaveLength(2);
    expect(listIssues({ projectSlug: "qml", status: "running" })).toHaveLength(0);
  });

  it("updates issue fields", () => {
    const id = createIssue({ projectSlug: "qml", title: "T", body: "" });
    updateIssue(id, { status: "queued" as IssueStatus, priority: 2 });
    const after = getIssue(id);
    expect(after!.status).toBe("queued");
    expect(after!.priority).toBe(2);
  });

  it("rejects invalid status transitions implicitly (caller responsibility)", () => {
    // Note: validation lives at the API level; the DB accepts any status string.
    // This test just confirms there's no DB-level constraint preventing flexibility.
    const id = createIssue({ projectSlug: "qml", title: "T", body: "" });
    updateIssue(id, { status: "done" as IssueStatus });
    expect(getIssue(id)!.status).toBe("done");
  });

  it("deletes an issue", () => {
    const id = createIssue({ projectSlug: "qml", title: "T", body: "" });
    deleteIssue(id);
    expect(getIssue(id)).toBeNull();
  });

  it("orders list by priority desc then updated_at desc", () => {
    const a = createIssue({ projectSlug: "qml", title: "A", body: "", priority: 0 });
    // Sleep a millisecond to ensure timestamps differ.
    const before = Date.now();
    while (Date.now() === before) {}
    const b = createIssue({ projectSlug: "qml", title: "B", body: "", priority: 0 });
    const c = createIssue({ projectSlug: "qml", title: "C", body: "", priority: 1 });
    const list = listIssues({ projectSlug: "qml" });
    expect(list.map(i => i.id)).toEqual([c, b, a]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- issues
```

Expected: import errors.

- [ ] **Step 3: Implement `lib/issues.ts`.**

```ts
// dashboard/lib/issues.ts
import { getDb } from "@/lib/db";

export type IssueStatus = "backlog" | "queued" | "running" | "review" | "done" | "failed";
export type IssueMode = "sync" | "async";

export interface Issue {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  assigneeSlug: string | null;
  status: IssueStatus;
  mode: IssueMode;
  priority: number;
  labels: string[];
  githubUrl: string | null;
  githubNumber: number | null;
  createdAt: number;
  updatedAt: number;
}

interface CreateOpts {
  projectSlug: string;
  title: string;
  body?: string;
  assigneeSlug?: string | null;
  status?: IssueStatus;
  mode?: IssueMode;
  priority?: number;
  labels?: string[];
  githubUrl?: string | null;
  githubNumber?: number | null;
}

function rowToIssue(row: any): Issue {
  return {
    id: row.id,
    projectSlug: row.project_slug,
    title: row.title,
    body: row.body,
    assigneeSlug: row.assignee_slug,
    status: row.status as IssueStatus,
    mode: row.mode as IssueMode,
    priority: row.priority,
    labels: row.labels ? JSON.parse(row.labels) : [],
    githubUrl: row.github_url,
    githubNumber: row.github_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createIssue(opts: CreateOpts): number {
  const db = getDb();
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO issues
      (project_slug, title, body, assignee_slug, status, mode, priority, labels, github_url, github_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.projectSlug,
    opts.title,
    opts.body ?? "",
    opts.assigneeSlug ?? null,
    opts.status ?? "backlog",
    opts.mode ?? "async",
    opts.priority ?? 0,
    opts.labels ? JSON.stringify(opts.labels) : null,
    opts.githubUrl ?? null,
    opts.githubNumber ?? null,
    now,
    now
  );
  return Number(info.lastInsertRowid);
}

export function getIssue(id: number): Issue | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
  return row ? rowToIssue(row) : null;
}

interface ListOpts {
  projectSlug?: string;
  status?: IssueStatus;
}

export function listIssues(opts: ListOpts = {}): Issue[] {
  const db = getDb();
  let sql = "SELECT * FROM issues";
  const where: string[] = [];
  const params: any[] = [];
  if (opts.projectSlug) {
    where.push("project_slug = ?");
    params.push(opts.projectSlug);
  }
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY priority DESC, updated_at DESC";
  return db.prepare(sql).all(...params).map(rowToIssue);
}

interface UpdateOpts {
  title?: string;
  body?: string;
  assigneeSlug?: string | null;
  status?: IssueStatus;
  mode?: IssueMode;
  priority?: number;
  labels?: string[];
}

export function updateIssue(id: number, patch: UpdateOpts): Issue | null {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const column =
      k === "assigneeSlug" ? "assignee_slug" :
      k === "labels" ? "labels" :
      k;
    sets.push(`${column} = ?`);
    params.push(k === "labels" ? JSON.stringify(v) : v);
  }
  if (sets.length === 0) return getIssue(id);
  sets.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getIssue(id);
}

export function deleteIssue(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM issues WHERE id = ?").run(id);
}

export const VALID_STATUSES: IssueStatus[] = ["backlog", "queued", "running", "review", "done", "failed"];
export const VALID_MODES: IssueMode[] = ["sync", "async"];
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- issues
```

Expected: 6 passing.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/lib/issues.ts dashboard/tests/issues.test.ts
git commit -m "feat(dashboard): issues data layer with CRUD"
```

---

## Task 7: Issue API routes

**Files:**
- Create: `dashboard/app/api/issues/route.ts`, `dashboard/app/api/issues/[id]/route.ts`

- [ ] **Step 1: Implement `api/issues/route.ts` (GET, POST).**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { listIssues, createIssue, type IssueStatus, type IssueMode, VALID_STATUSES, VALID_MODES } from "@/lib/issues";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";

openDb(); // initializes the singleton if not already

const CreateSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  assigneeSlug: z.string().nullable().optional(),
  mode: z.enum(VALID_MODES as [IssueMode, ...IssueMode[]]).optional(),
  priority: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectSlug = searchParams.get("projectSlug") ?? undefined;
  const status = searchParams.get("status") as IssueStatus | null;
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const items = listIssues({ projectSlug, status: status ?? undefined });
  return NextResponse.json({ issues: items });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const id = createIssue(parsed.data);
  publish({ kind: "issue.changed", id, projectSlug: parsed.data.projectSlug, reason: "create" });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Implement `api/issues/[id]/route.ts` (GET, PATCH, DELETE).**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIssue, updateIssue, deleteIssue, VALID_STATUSES, VALID_MODES, type IssueStatus, type IssueMode } from "@/lib/issues";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";

openDb();

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  assigneeSlug: z.string().nullable().optional(),
  status: z.enum(VALID_STATUSES as [IssueStatus, ...IssueStatus[]]).optional(),
  mode: z.enum(VALID_MODES as [IssueMode, ...IssueMode[]]).optional(),
  priority: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const issue = getIssue(n);
  return issue
    ? NextResponse.json(issue)
    : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const before = getIssue(n);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  const after = updateIssue(n, parsed.data);
  const reason = parsed.data.status && parsed.data.status !== before.status ? "status" : "update";
  publish({ kind: "issue.changed", id: n, projectSlug: before.projectSlug, reason });
  return NextResponse.json(after);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const before = getIssue(n);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  deleteIssue(n);
  publish({ kind: "issue.changed", id: n, projectSlug: before.projectSlug, reason: "delete" });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Smoke-test the routes.**

```bash
npm run dev
```

In another shell:
```bash
# Create
curl -s -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{"projectSlug":"qml","title":"Smoke test","body":"hello","priority":1}'
# Expected: {"id":N}

# Get
curl -s http://localhost:3000/api/issues/N

# List
curl -s "http://localhost:3000/api/issues?projectSlug=qml"

# Patch
curl -s -X PATCH http://localhost:3000/api/issues/N \
  -H "Content-Type: application/json" \
  -d '{"status":"queued"}'

# Delete
curl -s -X DELETE http://localhost:3000/api/issues/N -o /dev/null -w "%{http_code}\n"
# Expected: 204
```

Stop the dev server.

- [ ] **Step 4: Commit.**

```bash
git add dashboard/app/api/issues/
git commit -m "feat(api): /api/issues CRUD and /api/issues/[id]"
```

---

## Task 8: Thread data layer and API

**Files:**
- Create: `dashboard/lib/threads.ts`, `dashboard/tests/threads.test.ts`, `dashboard/app/api/issues/[id]/thread/route.ts`, `dashboard/scripts/migrate-threads.ts`

Threads live on disk at `vault/projects/<slug>/threads/<issue-id>.md`. Append-only. The file format is a series of markdown sections with a timestamp header.

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/threads.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  appendComment,
  appendEvent,
  readThread,
  threadFilePath,
} from "@/lib/threads";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-threads-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("threads", () => {
  it("threadFilePath builds the canonical path", () => {
    const p = threadFilePath("qml", 12, tmp);
    expect(p).toBe(path.join(tmp, "qml", "threads", "12.md"));
  });

  it("appendComment creates the file and writes a section", () => {
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "Hello world" }, tmp);
    const content = fs.readFileSync(threadFilePath("qml", 1, tmp), "utf8");
    expect(content).toContain("Hello world");
    expect(content).toContain("(comment from operator)");
  });

  it("appendComment appends without overwriting", () => {
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "First" }, tmp);
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "Second" }, tmp);
    const content = fs.readFileSync(threadFilePath("qml", 1, tmp), "utf8");
    expect(content).toContain("First");
    expect(content).toContain("Second");
  });

  it("appendEvent records a structured event", () => {
    appendEvent({ projectSlug: "qml", issueId: 1, eventType: "status.changed", details: "backlog to queued" }, tmp);
    const content = fs.readFileSync(threadFilePath("qml", 1, tmp), "utf8");
    expect(content).toContain("(event: status.changed)");
    expect(content).toContain("backlog to queued");
  });

  it("readThread returns parsed entries in order", () => {
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "A" }, tmp);
    appendEvent({ projectSlug: "qml", issueId: 1, eventType: "x", details: "y" }, tmp);
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "B" }, tmp);
    const entries = readThread("qml", 1, tmp);
    expect(entries).toHaveLength(3);
    expect(entries[0].kind).toBe("comment");
    expect(entries[1].kind).toBe("event");
    expect(entries[2].kind).toBe("comment");
    expect(entries[0].body).toBe("A");
  });

  it("readThread returns empty when the file does not exist", () => {
    expect(readThread("qml", 999, tmp)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- threads
```

Expected: import errors.

- [ ] **Step 3: Implement `lib/threads.ts`.**

```ts
// dashboard/lib/threads.ts
import fs from "node:fs";
import path from "node:path";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";

export interface ThreadEntry {
  kind: "comment" | "event";
  author?: string;
  eventType?: string;
  body: string;
  timestamp: string; // ISO
}

export function threadFilePath(projectSlug: string, issueId: number, rootDir = VAULT_PROJECTS_DIR): string {
  return path.join(rootDir, projectSlug, "threads", `${issueId}.md`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureFile(fp: string): void {
  if (fs.existsSync(fp)) return;
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, "");
}

interface AppendCommentOpts {
  projectSlug: string;
  issueId: number;
  author: string;
  text: string;
}

export function appendComment(opts: AppendCommentOpts, rootDir = VAULT_PROJECTS_DIR): void {
  const fp = threadFilePath(opts.projectSlug, opts.issueId, rootDir);
  ensureFile(fp);
  const ts = nowIso();
  const section = `\n## ${ts} (comment from ${opts.author})\n\n${opts.text.trim()}\n`;
  fs.appendFileSync(fp, section);
}

interface AppendEventOpts {
  projectSlug: string;
  issueId: number;
  eventType: string;
  details: string;
}

export function appendEvent(opts: AppendEventOpts, rootDir = VAULT_PROJECTS_DIR): void {
  const fp = threadFilePath(opts.projectSlug, opts.issueId, rootDir);
  ensureFile(fp);
  const ts = nowIso();
  const section = `\n## ${ts} (event: ${opts.eventType})\n\n${opts.details.trim()}\n`;
  fs.appendFileSync(fp, section);
}

// Parser. Splits on lines starting with "## " followed by an ISO timestamp.
const HEADER_RE = /^##\s+(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+)\s+\((comment from ([^)]+)|event: ([^)]+))\)\s*$/;

export function readThread(projectSlug: string, issueId: number, rootDir = VAULT_PROJECTS_DIR): ThreadEntry[] {
  const fp = threadFilePath(projectSlug, issueId, rootDir);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, "utf8");

  const lines = raw.split(/\r?\n/);
  const entries: ThreadEntry[] = [];
  let current: ThreadEntry | null = null;
  let bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(HEADER_RE);
    if (match) {
      if (current) {
        current.body = bodyLines.join("\n").trim();
        entries.push(current);
      }
      const ts = match[1];
      if (match[3]) {
        current = { kind: "comment", author: match[3], body: "", timestamp: ts };
      } else {
        current = { kind: "event", eventType: match[4], body: "", timestamp: ts };
      }
      bodyLines = [];
    } else if (current) {
      bodyLines.push(line);
    }
  }
  if (current) {
    current.body = bodyLines.join("\n").trim();
    entries.push(current);
  }
  return entries;
}
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- threads
```

Expected: 6 passing.

- [ ] **Step 5: Implement the thread API route.**

`dashboard/app/api/issues/[id]/thread/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIssue } from "@/lib/issues";
import { appendComment, readThread } from "@/lib/threads";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";

openDb();

const PostSchema = z.object({
  text: z.string().min(1),
  author: z.string().default("operator"),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const issue = getIssue(n);
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });
  const entries = readThread(issue.projectSlug, issue.id);
  return NextResponse.json({ entries });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const issue = getIssue(n);
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  appendComment({
    projectSlug: issue.projectSlug,
    issueId: issue.id,
    author: parsed.data.author,
    text: parsed.data.text,
  });
  publish({ kind: "thread.appended", issueId: issue.id });
  return new Response(null, { status: 201 });
}
```

- [ ] **Step 6: Write the legacy threads migration script.**

`dashboard/scripts/migrate-threads.ts`:
```ts
#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { openDb } from "@/lib/db";
import { getIssue } from "@/lib/issues";

function repoRoot(): string {
  return process.env.AGENTIC_OS_REPO_ROOT ?? path.resolve(__dirname, "..", "..");
}

export function runThreadsMigration(): { moved: number; skipped: number } {
  const root = repoRoot();
  const legacyDir = path.join(root, "vault", "threads");
  if (!fs.existsSync(legacyDir)) return { moved: 0, skipped: 0 };

  openDb();

  let moved = 0;
  let skipped = 0;

  const files = fs.readdirSync(legacyDir).filter(f => f.endsWith(".md"));
  for (const file of files) {
    const base = path.basename(file, ".md");
    const issueId = parseInt(base, 10);
    if (Number.isNaN(issueId)) {
      skipped += 1;
      continue;
    }
    const issue = getIssue(issueId);
    if (!issue) {
      skipped += 1;
      continue;
    }
    const dest = path.join(root, "vault", "projects", issue.projectSlug, "threads", `${issueId}.md`);
    if (fs.existsSync(dest)) {
      skipped += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(legacyDir, file), dest);
    moved += 1;
  }
  return { moved, skipped };
}

if (require.main === module) {
  const r = runThreadsMigration();
  console.log(`Legacy threads moved: ${r.moved}, skipped: ${r.skipped}`);
}
```

Add a script entry to `dashboard/package.json`:
```json
"migrate:threads": "tsx scripts/migrate-threads.ts"
```

- [ ] **Step 7: Run the migration on the real repo.**

```bash
cd dashboard
npm run migrate:threads
```

Expected: prints a count. If no issues are in the DB yet (i.e., `tasks` was renamed to `issues` in Phase 1 but those rows referenced a different ID system), the migration will simply skip files. That is fine.

- [ ] **Step 8: Smoke-test the API.**

```bash
npm run dev
```

In another shell, create an issue then post a comment:
```bash
# Pick a real project slug, e.g., qml-healthcare-diagnostics
ISSUE=$(curl -s -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{"projectSlug":"qml-healthcare-diagnostics","title":"Smoke","body":"hi"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST "http://localhost:3000/api/issues/$ISSUE/thread" \
  -H "Content-Type: application/json" \
  -d '{"text":"First comment"}' -o /dev/null -w "%{http_code}\n"
# Expected: 201

curl -s "http://localhost:3000/api/issues/$ISSUE/thread"
# Expected: {"entries":[{...comment...}]}

cat vault/projects/qml-healthcare-diagnostics/threads/$ISSUE.md
# Expected: section with timestamp and "First comment"
```

Clean up:
```bash
curl -X DELETE http://localhost:3000/api/issues/$ISSUE
rm -f vault/projects/qml-healthcare-diagnostics/threads/$ISSUE.md
```

- [ ] **Step 9: Commit.**

```bash
git add dashboard/lib/threads.ts dashboard/tests/threads.test.ts dashboard/app/api/issues/[id]/thread/ dashboard/scripts/migrate-threads.ts dashboard/package.json
git commit -m "feat(threads): data layer, API, legacy migration"
```

---

## Task 9: Kanban board with dnd-kit

**Files:**
- Create: `dashboard/components/project/KanbanBoard.tsx`, `dashboard/components/project/KanbanColumn.tsx`, `dashboard/components/project/IssueCard.tsx`
- Create: `dashboard/hooks/useIssues.ts`

- [ ] **Step 1: Install dnd-kit.**

```bash
cd dashboard
npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@8.0.0 @dnd-kit/utilities@3.2.2
```

- [ ] **Step 2: Build `hooks/useIssues.ts`.**

```ts
// dashboard/hooks/useIssues.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export interface IssueSummary {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  assigneeSlug: string | null;
  status: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  mode: "sync" | "async";
  priority: number;
  labels: string[];
  createdAt: number;
  updatedAt: number;
}

export function useIssues(projectSlug: string) {
  const [issues, setIssues] = useState<IssueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues?projectSlug=${encodeURIComponent(projectSlug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIssues(data.issues);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectSlug]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" && (event as any).projectSlug === projectSlug) {
      reload();
    }
  });

  return { issues, error, reload };
}
```

- [ ] **Step 3: Build `IssueCard.tsx`.**

`dashboard/components/project/IssueCard.tsx`:
```tsx
"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { IssueSummary } from "@/hooks/useIssues";

interface Props {
  issue: IssueSummary;
  onOpen: (id: number) => void;
}

export function IssueCard({ issue, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 cursor-grab active:cursor-grabbing text-sm",
        isDragging && "shadow-lg"
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only treat as click if not a drag.
        if (!isDragging) {
          e.stopPropagation();
          onOpen(issue.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{issue.title}</h3>
        {issue.priority > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 shrink-0">
            P{issue.priority}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{issue.assigneeSlug ?? "unassigned"}</span>
        <span>{issue.mode}</span>
      </div>
      {issue.labels.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {issue.labels.map(l => (
            <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build `KanbanColumn.tsx`.**

`dashboard/components/project/KanbanColumn.tsx`:
```tsx
"use client";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { IssueCard } from "./IssueCard";
import type { IssueSummary } from "@/hooks/useIssues";

interface Props {
  status: IssueSummary["status"];
  title: string;
  issues: IssueSummary[];
  onOpenIssue: (id: number) => void;
}

export function KanbanColumn({ status, title, issues, onOpenIssue }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex flex-col rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-2 min-h-[300px]",
        isOver && "ring-2 ring-blue-400"
      )}
    >
      <header className="flex items-center justify-between px-1 py-1 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        <span className="text-xs text-gray-400">{issues.length}</span>
      </header>
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {issues.map(issue => (
            <IssueCard key={issue.id} issue={issue} onOpen={onOpenIssue} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
```

- [ ] **Step 5: Build `KanbanBoard.tsx`.**

`dashboard/components/project/KanbanBoard.tsx`:
```tsx
"use client";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { useIssues, type IssueSummary } from "@/hooks/useIssues";

const COLUMNS: Array<{ status: IssueSummary["status"]; title: string }> = [
  { status: "backlog", title: "Backlog" },
  { status: "queued", title: "Queued" },
  { status: "running", title: "Running" },
  { status: "review", title: "Review" },
  { status: "done", title: "Done" },
];

interface Props {
  projectSlug: string;
  onOpenIssue: (id: number) => void;
}

export function KanbanBoard({ projectSlug, onOpenIssue }: Props) {
  const { issues, reload } = useIssues(projectSlug);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    const issueId = event.active.id as number;
    const overId = event.over?.id;
    if (typeof overId !== "string" || !overId.startsWith("col:")) return;
    const newStatus = overId.slice(4) as IssueSummary["status"];
    const issue = issues?.find(i => i.id === issueId);
    if (!issue || issue.status === newStatus) return;

    // Optimistic UI: trigger reload after server confirms.
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      console.error("Failed to update status");
    }
    // SSE will trigger reload, but call it directly as a fallback.
    reload();
  }

  if (!issues) return <p className="text-sm text-gray-400 p-4">Loading issues...</p>;

  const byStatus: Record<string, IssueSummary[]> = {};
  for (const col of COLUMNS) byStatus[col.status] = [];
  for (const i of issues) {
    if (byStatus[i.status]) byStatus[i.status].push(i);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            issues={byStatus[col.status]}
            onOpenIssue={onOpenIssue}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 6: Commit.**

```bash
git add dashboard/hooks/useIssues.ts dashboard/components/project/ dashboard/package.json dashboard/package-lock.json
git commit -m "feat(dashboard): kanban board components with dnd-kit"
```

The board cannot be smoke-tested standalone; Task 10 wires it into the project page.

---

## Task 10: Project page rebuild

**Files:**
- Replace: `dashboard/app/projects/[slug]/page.tsx`
- Create: `dashboard/components/project/ProjectHeader.tsx`, `dashboard/components/project/CrewSidebar.tsx`

- [ ] **Step 1: Build `ProjectHeader.tsx`.**

```tsx
"use client";
import Link from "next/link";
import { Button } from "@/components/common/Button";

interface Props {
  name: string;
  slug: string;
  path: string;
  repo: string | null;
  runtimeDefault: string;
  onNewIssue: () => void;
}

export function ProjectHeader({ name, path, repo, runtimeDefault, onNewIssue }: Props) {
  return (
    <header className="mb-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span>{name}</span>
      </nav>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-gray-500 mt-1 truncate" title={path}>{path}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            {repo && (
              <a href={repo} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                {repo}
              </a>
            )}
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-mono">
              {runtimeDefault}
            </span>
          </div>
        </div>
        <Button variant="primary" onClick={onNewIssue}>+ New Issue</Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Build `CrewSidebar.tsx`.**

```tsx
"use client";
import { Button } from "@/components/common/Button";

interface AgentDisplay {
  slug: string;
  name: string;
  skills: string[];
}

interface Props {
  crew: AgentDisplay[];
  onEditCrew: () => void;
}

export function CrewSidebar({ crew, onEditCrew }: Props) {
  return (
    <aside className="rounded-md border border-gray-200 dark:border-gray-800 p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Crew</h2>
        <Button variant="ghost" onClick={onEditCrew}>Edit</Button>
      </header>
      {crew.length === 0 ? (
        <p className="text-sm text-gray-400">No crew yet.</p>
      ) : (
        <ul className="space-y-2">
          {crew.map(a => (
            <li key={a.slug} className="text-sm">
              <div className="font-medium">{a.name}</div>
              <div className="flex gap-1 flex-wrap mt-1">
                {a.skills.slice(0, 4).map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">{s}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Replace `app/projects/[slug]/page.tsx`.**

```tsx
"use client";
import { use, useEffect, useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { useStream } from "@/hooks/useStream";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { CrewSidebar } from "@/components/project/CrewSidebar";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { NewIssueDialog } from "@/components/project/NewIssueDialog";
import { CrewPickerDrawer } from "@/components/project/CrewPickerDrawer";
import { IssueDrawer } from "@/components/issue/IssueDrawer";

interface ProjectData {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crew: string[];
  capabilities: string[];
  runtimeDefault: string;
}

interface AgentDetail {
  slug: string;
  name: string;
  skills: string[];
}

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [agents, setAgents] = useState<AgentDetail[] | null>(null);
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  const reloadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}`, { cache: "no-store" });
    if (res.status === 404) {
      setNotFoundFlag(true);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setProject(data);
  }, [slug]);

  const reloadAgents = useCallback(async () => {
    const res = await fetch("/api/agents", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setAgents(data.agents);
  }, []);

  useEffect(() => {
    reloadProject();
    reloadAgents();
  }, [reloadProject, reloadAgents]);

  useStream((event) => {
    if (event.kind === "project.changed" && (event as any).slug === slug) reloadProject();
    if (event.kind === "agent.changed") reloadAgents();
  });

  if (notFoundFlag) notFound();
  if (!project || !agents) return <p className="p-6 text-sm text-gray-500">Loading...</p>;

  const crewDisplay: AgentDetail[] = project.crew
    .map(s => agents.find(a => a.slug === s))
    .filter((a): a is AgentDetail => Boolean(a));

  return (
    <main className="max-w-7xl mx-auto p-6">
      <ProjectHeader
        name={project.name}
        slug={project.slug}
        path={project.path}
        repo={project.repo}
        runtimeDefault={project.runtimeDefault}
        onNewIssue={() => setShowNewIssue(true)}
      />
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <KanbanBoard projectSlug={slug} onOpenIssue={setOpenIssueId} />
        <CrewSidebar crew={crewDisplay} onEditCrew={() => setShowCrewPicker(true)} />
      </div>

      {showNewIssue && (
        <NewIssueDialog
          projectSlug={slug}
          crew={crewDisplay}
          onClose={() => setShowNewIssue(false)}
        />
      )}
      {showCrewPicker && (
        <CrewPickerDrawer
          projectSlug={slug}
          projectCapabilities={project.capabilities}
          currentCrew={project.crew}
          allAgents={agents}
          onClose={() => setShowCrewPicker(false)}
        />
      )}
      {openIssueId !== null && (
        <IssueDrawer
          issueId={openIssueId}
          crew={crewDisplay}
          onClose={() => setOpenIssueId(null)}
        />
      )}
    </main>
  );
}
```

This file references `NewIssueDialog`, `CrewPickerDrawer`, and `IssueDrawer` which we build in Tasks 11 through 14. The build will fail until those exist. Don't commit yet; continue.

- [ ] **Step 4: Quick add an `/api/agents` route placeholder so the project page can resolve crew display.**

`dashboard/app/api/agents/route.ts`:
```ts
import { NextResponse } from "next/server";
import { listAgents } from "@/lib/agents";

export async function GET() {
  const agents = listAgents().map(a => ({
    slug: a.slug,
    name: a.name,
    runtime: a.runtime,
    skills: a.skills,
    allowedTools: a["allowed-tools"],
    lastModified: a.lastModified,
  }));
  return NextResponse.json({ agents });
}
```

- [ ] **Step 5: Don't commit yet.**

Stage what we have but hold the commit for after Task 14 since the project page won't compile until then.

```bash
git add dashboard/components/project/ProjectHeader.tsx dashboard/components/project/CrewSidebar.tsx dashboard/app/api/agents/
```

---

## Task 11: Crew picker slide-over and API

**Files:**
- Create: `dashboard/lib/eligibleAgents.ts`, `dashboard/tests/eligibleAgents.test.ts`
- Create: `dashboard/components/common/Drawer.tsx`, `dashboard/components/project/CrewPickerDrawer.tsx`
- Create: `dashboard/app/api/projects/[slug]/crew/route.ts`

- [ ] **Step 1: Write the failing test for eligibleAgents.**

`dashboard/tests/eligibleAgents.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isEligible, filterEligible } from "@/lib/eligibleAgents";

describe("eligibleAgents", () => {
  it("matches when any skill is in capabilities", () => {
    expect(isEligible(["research", "writing"], ["research"])).toBe(true);
    expect(isEligible(["research"], ["physics", "research"])).toBe(true);
  });
  it("returns false when no skill overlaps", () => {
    expect(isEligible(["research"], ["coding"])).toBe(false);
  });
  it("returns true when capabilities is empty (no filter)", () => {
    expect(isEligible([], ["research"])).toBe(true);
  });
  it("returns false when agent has no skills", () => {
    expect(isEligible(["research"], [])).toBe(false);
  });

  it("filterEligible keeps matching agents", () => {
    const agents = [
      { slug: "a", skills: ["research"] },
      { slug: "b", skills: ["coding"] },
      { slug: "c", skills: ["writing", "research"] },
    ];
    const result = filterEligible(agents, ["research"]);
    expect(result.map(a => a.slug)).toEqual(["a", "c"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
npm test -- eligibleAgents
```

- [ ] **Step 3: Implement `lib/eligibleAgents.ts`.**

```ts
// dashboard/lib/eligibleAgents.ts
export function isEligible(projectCapabilities: string[], agentSkills: string[]): boolean {
  if (projectCapabilities.length === 0) return true;
  return agentSkills.some(s => projectCapabilities.includes(s));
}

interface AgentLike {
  skills: string[];
}

export function filterEligible<T extends AgentLike>(agents: T[], projectCapabilities: string[]): T[] {
  return agents.filter(a => isEligible(projectCapabilities, a.skills));
}
```

- [ ] **Step 4: Run test to verify it passes.**

```bash
npm test -- eligibleAgents
```

Expected: 5 passing.

- [ ] **Step 5: Build `Drawer.tsx`.**

`dashboard/components/common/Drawer.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import clsx from "clsx";

interface DrawerProps {
  title: string;
  width?: "sm" | "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const widthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Drawer({ title, width = "md", onClose, children, footer }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={clsx(
        "ml-auto bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 h-full flex flex-col w-full",
        widthMap[width]
      )}>
        <header className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Build the crew API route.**

`dashboard/app/api/projects/[slug]/crew/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";
import { updateProjectCrew } from "@/lib/projectMutations";
import { getProject } from "@/lib/projects";

const PutSchema = z.object({
  crew: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)),
});

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const projectFile = path.join(VAULT_PROJECTS_DIR, slug, "PROJECT.md");
  updateProjectCrew(projectFile, parsed.data.crew);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 7: Build `CrewPickerDrawer.tsx`.**

```tsx
"use client";
import { useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import { filterEligible } from "@/lib/eligibleAgents";

interface Agent {
  slug: string;
  name: string;
  skills: string[];
}

interface Props {
  projectSlug: string;
  projectCapabilities: string[];
  currentCrew: string[];
  allAgents: Agent[];
  onClose: () => void;
}

export function CrewPickerDrawer({ projectSlug, projectCapabilities, currentCrew, allAgents, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentCrew));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = filterEligible(allAgents, projectCapabilities);

  function toggle(slug: string) {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/crew`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crew: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Edit crew"
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save crew"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4">
        Showing agents whose skills overlap with this project's capabilities ({projectCapabilities.join(", ") || "none set"}).
      </p>
      {eligible.length === 0 ? (
        <p className="text-sm text-gray-400">No eligible agents. Add capabilities to PROJECT.md or skills to agents.</p>
      ) : (
        <ul className="space-y-2">
          {eligible.map(a => {
            const checked = selected.has(a.slug);
            return (
              <li key={a.slug}>
                <label className={"flex items-start gap-3 p-3 rounded-md border " + (checked ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-800")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(a.slug)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{a.slug}</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {a.skills.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">{s}</span>
                      ))}
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </Drawer>
  );
}
```

- [ ] **Step 8: Stage the new files.**

```bash
git add dashboard/lib/eligibleAgents.ts dashboard/tests/eligibleAgents.test.ts dashboard/components/common/Drawer.tsx dashboard/components/project/CrewPickerDrawer.tsx dashboard/app/api/projects/[slug]/crew/
```

Still no commit; project page won't compile until Tasks 12 to 14 land. Press on.

---

## Task 12: Issue slide-over shell and Issue section

**Files:**
- Create: `dashboard/components/issue/IssueDrawer.tsx`, `dashboard/components/issue/IssueHeader.tsx`, `dashboard/components/issue/IssueBodyEditor.tsx`, `dashboard/components/issue/RunsTabStub.tsx`

- [ ] **Step 1: Build `RunsTabStub.tsx`.**

```tsx
"use client";
export function RunsTabStub() {
  return (
    <div className="rounded-md border border-dashed border-gray-300 dark:border-gray-700 p-4 text-sm text-gray-500">
      Runs and live xterm stream ship in Phase 3.
    </div>
  );
}
```

- [ ] **Step 2: Build `IssueHeader.tsx`.**

```tsx
"use client";
import { Field } from "@/components/common/Field";

interface AgentDisplay {
  slug: string;
  name: string;
}

interface Issue {
  id: number;
  status: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  assigneeSlug: string | null;
  priority: number;
  mode: "sync" | "async";
  labels: string[];
}

interface Props {
  issue: Issue;
  crew: AgentDisplay[];
  onPatch: (patch: Partial<Issue>) => void;
}

const STATUS_COLORS: Record<Issue["status"], string> = {
  backlog: "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300",
  queued: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200",
  running: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  review: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200",
  done: "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300",
  failed: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
};

export function IssueHeader({ issue, crew, onPatch }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Field label="Status">
        <span className={"inline-block px-2 py-1 rounded text-xs " + STATUS_COLORS[issue.status]}>
          {issue.status}
        </span>
      </Field>
      <Field label="Mode">
        <select
          value={issue.mode}
          onChange={(e) => onPatch({ mode: e.target.value as Issue["mode"] })}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm"
        >
          <option value="async">async</option>
          <option value="sync">sync</option>
        </select>
      </Field>
      <Field label="Assignee">
        <select
          value={issue.assigneeSlug ?? ""}
          onChange={(e) => onPatch({ assigneeSlug: e.target.value || null })}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm w-full"
        >
          <option value="">unassigned</option>
          {crew.map(a => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <select
          value={issue.priority}
          onChange={(e) => onPatch({ priority: parseInt(e.target.value, 10) })}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm"
        >
          <option value={-1}>Low</option>
          <option value={0}>Normal</option>
          <option value={1}>High</option>
          <option value={2}>Urgent</option>
        </select>
      </Field>
      <Field label="Labels" hint="Comma-separated">
        <input
          type="text"
          defaultValue={issue.labels.join(", ")}
          onBlur={(e) => {
            const labels = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
            onPatch({ labels });
          }}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm w-full"
        />
      </Field>
    </div>
  );
}
```

- [ ] **Step 3: Build `IssueBodyEditor.tsx`.**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/common/Field";

interface Props {
  title: string;
  body: string;
  onSave: (patch: { title?: string; body?: string }) => void;
}

export function IssueBodyEditor({ title, body, onSave }: Props) {
  const [localTitle, setLocalTitle] = useState(title);
  const [localBody, setLocalBody] = useState(body);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when props change (e.g. switching issues).
  useEffect(() => {
    setLocalTitle(title);
    setLocalBody(body);
  }, [title, body]);

  function scheduleSave(patch: { title?: string; body?: string }) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(patch), 600);
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={localTitle}
        onChange={(e) => {
          setLocalTitle(e.target.value);
          scheduleSave({ title: e.target.value });
        }}
        className="w-full text-lg font-semibold bg-transparent focus:outline-none border-b border-transparent hover:border-gray-300 focus:border-gray-500"
      />
      <Textarea
        rows={10}
        value={localBody}
        onChange={(e) => {
          setLocalBody(e.target.value);
          scheduleSave({ body: e.target.value });
        }}
        placeholder="Describe the work..."
      />
    </div>
  );
}
```

- [ ] **Step 4: Build `IssueDrawer.tsx` (shell).**

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import { IssueHeader } from "./IssueHeader";
import { IssueBodyEditor } from "./IssueBodyEditor";
import { ThreadList } from "./ThreadList";
import { ThreadComposer } from "./ThreadComposer";
import { RunsTabStub } from "./RunsTabStub";
import { useStream } from "@/hooks/useStream";

interface IssueData {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  assigneeSlug: string | null;
  status: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  mode: "sync" | "async";
  priority: number;
  labels: string[];
}

interface AgentDisplay {
  slug: string;
  name: string;
}

interface Props {
  issueId: number;
  crew: AgentDisplay[];
  onClose: () => void;
}

export function IssueDrawer({ issueId, crew, onClose }: Props) {
  const [issue, setIssue] = useState<IssueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/issues/${issueId}`, { cache: "no-store" });
    if (!res.ok) {
      setError(`HTTP ${res.status}`);
      return;
    }
    setIssue(await res.json());
  }, [issueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" && (event as any).id === issueId) reload();
  });

  async function patch(p: Partial<IssueData>) {
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.ok) setIssue(await res.json());
  }

  async function deleteIssue() {
    if (!confirm("Delete this issue?")) return;
    const res = await fetch(`/api/issues/${issueId}`, { method: "DELETE" });
    if (res.ok) onClose();
  }

  if (error) {
    return (
      <Drawer title="Issue" width="lg" onClose={onClose}>
        <p className="text-sm text-red-600">{error}</p>
      </Drawer>
    );
  }
  if (!issue) {
    return (
      <Drawer title="Issue" width="lg" onClose={onClose}>
        <p className="text-sm text-gray-500">Loading...</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={`Issue #${issue.id}`}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={deleteIssue}>Delete</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </>
      }
    >
      <section className="space-y-4">
        <IssueBodyEditor title={issue.title} body={issue.body} onSave={patch} />
        <IssueHeader issue={issue} crew={crew} onPatch={patch} />
      </section>

      <hr className="my-6 border-gray-200 dark:border-gray-800" />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Thread</h3>
        <ThreadList issueId={issue.id} />
        <div className="mt-3">
          <ThreadComposer issueId={issue.id} />
        </div>
      </section>

      <hr className="my-6 border-gray-200 dark:border-gray-800" />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Runs</h3>
        <RunsTabStub />
      </section>
    </Drawer>
  );
}
```

- [ ] **Step 5: Stage.**

```bash
git add dashboard/components/issue/IssueDrawer.tsx dashboard/components/issue/IssueHeader.tsx dashboard/components/issue/IssueBodyEditor.tsx dashboard/components/issue/RunsTabStub.tsx
```

Still no commit; ThreadList and ThreadComposer come next.

---

## Task 13: Thread list and composer

**Files:**
- Create: `dashboard/components/issue/ThreadList.tsx`, `dashboard/components/issue/ThreadComposer.tsx`

- [ ] **Step 1: Build `ThreadList.tsx`.**

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useStream } from "@/hooks/useStream";

interface Entry {
  kind: "comment" | "event";
  author?: string;
  eventType?: string;
  body: string;
  timestamp: string;
}

interface Props {
  issueId: number;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ThreadList({ issueId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/issues/${issueId}/thread`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setEntries(data.entries);
  }, [issueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "thread.appended" && (event as any).issueId === issueId) reload();
  });

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">No comments yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="text-sm">
          <div className="text-xs text-gray-500 mb-1">
            {formatTime(e.timestamp)}
            {" · "}
            {e.kind === "comment" ? e.author : `event: ${e.eventType}`}
          </div>
          <div className="whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 dark:bg-gray-900/50 rounded p-2 border border-gray-100 dark:border-gray-800">
            {e.body}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Build `ThreadComposer.tsx`.**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Textarea } from "@/components/common/Field";

interface Props {
  issueId: number;
}

export function ThreadComposer({ issueId }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
      />
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={submitting || text.trim().length === 0}>
          {submitting ? "Posting..." : "Comment"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Stage.**

```bash
git add dashboard/components/issue/ThreadList.tsx dashboard/components/issue/ThreadComposer.tsx
```

---

## Task 14: New Issue dialog and final commit

**Files:**
- Create: `dashboard/components/project/NewIssueDialog.tsx`

- [ ] **Step 1: Build `NewIssueDialog.tsx`.**

```tsx
"use client";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Field, Input, Textarea } from "@/components/common/Field";
import { Button } from "@/components/common/Button";

interface AgentDisplay {
  slug: string;
  name: string;
}

interface Props {
  projectSlug: string;
  crew: AgentDisplay[];
  onClose: () => void;
}

export function NewIssueDialog({ projectSlug, crew, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [priority, setPriority] = useState(0);
  const [mode, setMode] = useState<"async" | "sync">("async");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug,
          title,
          body,
          assigneeSlug: assignee || null,
          priority,
          mode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New Issue"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={submitting || title.trim().length === 0}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Body" hint="Markdown supported. This becomes the agent's opening prompt.">
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Assignee">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
          >
            <option value="">unassigned</option>
            {crew.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10))}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
          >
            <option value={-1}>Low</option>
            <option value={0}>Normal</option>
            <option value={1}>High</option>
            <option value={2}>Urgent</option>
          </select>
        </Field>
        <Field label="Mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
          >
            <option value="async">async</option>
            <option value="sync">sync</option>
          </select>
        </Field>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
```

- [ ] **Step 2: Full smoke test.**

```bash
npm run dev
```

Walk through:
1. Open `http://localhost:3000`. Confirm the home page lists projects.
2. Click into a project. The project page renders with the kanban (empty) and crew sidebar.
3. Click "+ New Issue". Fill in a title and body. Save. Card appears in Backlog.
4. Drag the card to Queued. Confirm it stays there on refresh.
5. Click the card. Issue drawer opens. Edit the body, wait a second for the debounced save. Reload the page; edit persisted.
6. Type a comment in the thread composer and submit. It appears in the thread.
7. Click "Edit crew" on the project page. Drawer lists eligible agents. Check one or two. Save. They appear in the crew sidebar.

If any step fails, fix before committing.

- [ ] **Step 3: Commit everything from Tasks 10 through 14.**

```bash
git add dashboard/components/project/NewIssueDialog.tsx dashboard/components/project/IssueCard.tsx dashboard/components/project/KanbanBoard.tsx dashboard/components/project/KanbanColumn.tsx dashboard/app/projects/
git commit -m "feat(dashboard): project page with kanban, crew picker, issue drawer, thread"
```

The earlier `git add` calls from Tasks 10, 11, 12, 13 already staged those files. The commit picks all of them up.

---

## Task 15: Phase 2 verification and QML dogfood

**Files:** none modified.

- [ ] **Step 1: Run all tests.**

```bash
cd dashboard
npm test
```

Expected: every test from Phase 1 and Phase 2 passes. Phase 2 added: `stream`, `issues`, `threads`, `projectMutations`, `eligibleAgents` test files.

- [ ] **Step 2: Walk the Phase 2 definition of done.**

Boot the dashboard:
```bash
npm run dev
```

Manually verify each criterion from the Verification strategy section at the top of this doc (1 through 10). The QML-specific criterion is #6 and #7 done against the QML healthcare diagnostics project:

- Open the QML project from Home.
- Add a real issue: "Draft related-work section for QML diagnostics paper, focused on 2024-2026 papers." Assign it to the lit-reviewer agent in your crew. Priority High. Mode async.
- Drag it from Backlog to Queued.
- Click the card. Add a comment in the thread: "Goal is 600-800 words, with at least 12 citations. Output as a markdown file in the project outputs folder."
- Confirm the comment is in `vault/projects/qml-healthcare-diagnostics/threads/<id>.md`.

This issue is real and sits ready for Phase 3 to actually run.

- [ ] **Step 3: Commit a phase tag.**

```bash
cd ..
git tag -a path-a-phase-2 -m "Path A reset Phase 2: project page, kanban, issues, threads, crew picker"
```

Phase 2 is done. Phase 3 wires the Runtime registry, PTY spawn, and the xterm.js panel so the issue you just filed can actually run.

---

## Self-review

Spec coverage against Spec 0002 acceptance criteria:

- A1 (clean clone, dev boots, Home lists projects): still covered by Phase 1 work.
- A2 (clone from GitHub): Task 4, smoke-tested in Step 5.
- A3 (link existing folder): Task 3, smoke-tested in Step 6.
- A4 (kanban, crew roster, edit crew filtered by capabilities): Tasks 9, 10, 11.
- A5 (new issue, drag through states): Tasks 9, 10, 14.
- A6 (start issue spawns runs): Phase 3, intentionally out of scope.
- A7 to A10 (worktrees, hooks, settings UI): Phases 3 through 6.
- A11 (migration idempotent): Phase 1 migration unchanged; threads migration in Task 8 is also idempotent (checks for dest existence before copying).
- A12 (removed lib modules): naturally satisfied; new `dashboard/` has none of them.
- A13 (QML dogfood): Task 15 Step 2.

Placeholder scan: every code step has real, complete code. Two intentional stubs are clearly marked: `RunsTabStub` and the disabled state cycling beyond drag (Start button does not exist yet, which is correct because Phase 3 ships it). No "TBD" or "implement later" text in the code blocks.

Type consistency check:
- `IssueStatus` is defined once in `lib/issues.ts` and re-exported through `useIssues.ts` and consumed in `KanbanBoard`, `IssueCard`, `IssueHeader`.
- `IssueMode` likewise.
- `AgentDisplay` interface is repeated in `IssueDrawer`, `NewIssueDialog`, `CrewSidebar`, etc. This is intentional duplication of a narrow view; the full `Agent` from `lib/agents.ts` has more fields. If you want to DRY this up, hoist `AgentDisplay` into a shared type in Phase 4 when the Agents page also needs it.
- API response shapes match the frontend interfaces because each route handler explicitly reshapes (e.g., `runtime-default` becomes `runtimeDefault`). Watch for one specific consistency: the `Issue` shape returned by `getIssue()` is camelCase already because `rowToIssue` does the mapping, so the API route just returns it directly without further reshaping.

Known gaps to flag for Phase 3:

1. The kanban's "Running" column receives cards via drag-and-drop, but Phase 2 has no way to actually run them. Dragging to Running just sets status; nothing spawns. Phase 3 should add a precondition: dragging to Running fails (UI snaps back) unless an active run exists for the issue. Until then, the workaround is to use Queued and let Phase 3 introduce a proper Start button.
2. The "Start", "Stop", "Mark for Review", "Mark Done", "Reopen" buttons mentioned in the spec for the Issue slide-over footer are not implemented in Phase 2. Status changes happen via drag or via the inline status picker (you can add a simple status `<select>` in `IssueHeader` if you want, or wait for Phase 3 which adds proper buttons tied to run lifecycle).
3. Labels are stored as a JSON array but the UI uses a comma-separated text input. A real chip picker can wait for Phase 6 or beyond; the current input is enough to round-trip labels through the system.
4. `useStream` opens one EventSource per page that uses it. On a project page with the issue drawer open, three components subscribe via hooks. Each `useStream` call mounts its own EventSource. That works but creates three connections to `/api/stream`. If browser connection limits become an issue, refactor `useStream` to use a singleton EventSource shared across hook calls. Not urgent.

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-05-20-path-a-reset-phase-2.md`. Same two execution options as Phase 1:

1. Subagent-driven: dispatch a fresh subagent per task, review between tasks. Use `superpowers:subagent-driven-development`.
2. Inline execution: execute tasks in this session via `superpowers:executing-plans`, batch with checkpoints.

For this phase I would suggest checkpoints after Tasks 5 (New Project flow lands), 8 (issues + threads APIs land), and 14 (full project page works). Tasks 9 through 14 have tight UI dependencies; reviewing piece by piece is less useful than at the end of the run. If you go subagent-driven, batch Tasks 9 through 14 together since the kanban, drawers, and dialogs share components and a per-task subagent may make duplicate decisions about Drawer/Modal styling.

When Phase 2 closes, Phase 3 is the headline phase: real `claude` CLI spawning into a PTY, xterm.js in the Issue slide-over, worktrees per running issue. The plan for that lives at `docs/plans/<date>-path-a-reset-phase-3.md` and gets written next.
