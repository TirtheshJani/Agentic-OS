# Dashboard Polish Implementation Plan

> **For agentic workers:** Use `_meta/executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Validate with `cd dashboard && npm run lint` after each task; visual checks via `cd dashboard && npm run dev`.

**Goal:** Polish the existing Agentic OS dashboard to match TJ's site (tirtheshjani.com) — dark-sky background, brand-blue accent, starfield motif, monospace pills, MMXXVI year stamp, uppercase nav labels — while keeping the existing 3-column layout and existing right-rail cards, and surfacing the branch taxonomy from `product/architecture.md`.

**Architecture:** Tokens-first refactor. Update CSS custom properties in `app/globals.css` to the dark-sky palette, then introduce three primitives (`Pill`, `SectionHeader`, `StatusDot`) and a `Starfield` background, then restyle each existing component using those primitives. Skills rail re-groups by branch family (foundation / capability / project). Skill cards gain cadence pills. No new layout columns; no new data sources this pass.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4 (CSS variables via `@theme inline`), shadcn/ui primitives already vendored.

**Important precondition:** `dashboard/AGENTS.md` says "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code." For this plan the only Next-specific touches are an existing client component pattern and the existing API route shapes — no new server actions or routing changes. Skim `node_modules/next/dist/docs/02-app/01-getting-started/` only if a step adds routing.

---

## File structure

**New files:**

- `dashboard/components/ui/pill.tsx` — bracketed monospace label (`[· FLAT]`, `[▼ 81%]`).
- `dashboard/components/ui/section-header.tsx` — `◢ TITLE ──── meta` divider.
- `dashboard/components/ui/status-dot.tsx` — colored dot (idle / running / blocked).
- `dashboard/components/starfield.tsx` — fixed-position low-opacity constellation backdrop.
- `dashboard/components/header.tsx` — top bar with `AGENTICOS · MMXXVI` stamp, idle indicator, nav.
- `dashboard/lib/branches.ts` — pure mapping from skill domain → branch family.

**Modified files:**

- `dashboard/app/globals.css` — palette swap (dark-sky + brand-blue), mono heading utility.
- `dashboard/app/page.tsx` — inject Starfield, Header above the 3-col grid.
- `dashboard/lib/skills-loader.ts` — expose `branchFamily` on each Skill.
- `dashboard/components/workbench.tsx` — empty-state hero "RUN A SKILL TO BEGIN".
- `dashboard/components/skills-rail.tsx` — group by branch family with SectionHeaders; cadence pills.
- `dashboard/components/usage-card.tsx` — bracketed pills, blue fills, `RESETS · NOW` labels.
- `dashboard/components/recent-runs-card.tsx` — time-prefix list, monospace.
- `dashboard/components/vault-recent-card.tsx`, `vault-search-card.tsx`, `forecast-card.tsx` — apply primitives consistently.

**Untouched:**

- `dashboard/lib/claude-headless.ts`, `db.ts`, `analytics.ts`, all `app/api/*` — no behavior change.
- `dashboard/components/ui/{card,button,badge,scroll-area}.tsx` — leave shadcn primitives alone; override via className.

---

## Task 1: Theme tokens — dark sky and brand blue

**Files:**
- Modify: `dashboard/app/globals.css`

The reference screenshot uses orange. TJ's site uses a dark-sky palette with a "brand blue" accent and starfield motifs. Replace the current neutral palette.

- [ ] **Step 1: Confirm site palette** — Open `https://www.tirtheshjani.com` in a browser, open DevTools, inspect the body and an accent element. Note the exact hex of background, foreground, and primary accent. The values in Step 2 are best-guess approximations of "dark sky charcoal" + "brand blue"; replace them with the inspected values if they differ.

- [ ] **Step 2: Overwrite `dashboard/app/globals.css`**

```css
@import "tailwindcss";

:root {
  /* Dark-sky palette — single mode (no light theme; the site is dark-only) */
  --background: oklch(0.13 0.02 250);          /* deep navy near-black */
  --foreground: oklch(0.96 0.01 250);          /* near-white, slight cool */
  --card: oklch(0.16 0.02 250);                /* card slightly lifted */
  --card-foreground: oklch(0.96 0.01 250);

  --primary: oklch(0.68 0.18 250);             /* brand blue */
  --primary-foreground: oklch(0.13 0.02 250);

  --secondary: oklch(0.22 0.02 250);
  --secondary-foreground: oklch(0.96 0.01 250);

  --muted: oklch(0.22 0.02 250);
  --muted-foreground: oklch(0.62 0.03 250);

  --accent: oklch(0.68 0.18 250);              /* brand blue, same as primary for now */
  --accent-foreground: oklch(0.13 0.02 250);

  --destructive: oklch(0.62 0.22 25);
  --destructive-foreground: oklch(0.96 0.01 250);

  --border: oklch(0.27 0.02 250);
  --ring: oklch(0.68 0.18 250);

  /* Status semantics */
  --status-idle: oklch(0.62 0.03 250);
  --status-running: oklch(0.78 0.18 130);      /* green */
  --status-blocked: oklch(0.7 0.2 30);         /* amber-red */

  /* Starfield base for the radial-gradient backdrop */
  --star-color: oklch(0.7 0.05 250 / 0.5);
}

/* No prefers-color-scheme override — site is dark-only. */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), system-ui, sans-serif;
}

/* Mono header utility — used by SectionHeader and Pill */
.mono-label {
  font-family: var(--font-mono), ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
}
```

- [ ] **Step 3: Verify** — `cd dashboard && npm run dev`, open `http://localhost:3000`. Background should be near-black with a cool/blue tint. Existing cards should still render (slightly lifted background). Buttons render with brand-blue primary. No light-mode flicker.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/globals.css
git commit -m "dashboard: dark-sky palette and brand-blue accent"
```

---

## Task 2: Pill primitive

**Files:**
- Create: `dashboard/components/ui/pill.tsx`

Reusable bracketed monospace label. Variants for status, trend, and neutral.

- [ ] **Step 1: Write `dashboard/components/ui/pill.tsx`**

```tsx
import { cn } from "@/lib/utils";

type PillTone = "default" | "muted" | "good" | "warn" | "bad";

const TONE_CLASS: Record<PillTone, string> = {
  default: "text-foreground border-border",
  muted: "text-muted-foreground border-border",
  good: "text-[oklch(0.78_0.18_130)] border-[oklch(0.78_0.18_130)]",
  warn: "text-[oklch(0.78_0.15_80)] border-[oklch(0.78_0.15_80)]",
  bad: "text-[oklch(0.7_0.2_30)] border-[oklch(0.7_0.2_30)]",
};

export function Pill({
  children,
  tone = "default",
  glyph,
  className,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  glyph?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-sm mono-label",
        TONE_CLASS[tone],
        className
      )}
    >
      {glyph && <span aria-hidden>{glyph}</span>}
      <span>{children}</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify import resolves** — `cd dashboard && npx tsc --noEmit` (or `npm run lint`). No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/ui/pill.tsx
git commit -m "dashboard: Pill primitive for bracketed mono labels"
```

---

## Task 3: SectionHeader primitive

**Files:**
- Create: `dashboard/components/ui/section-header.tsx`

Header row used above grouped lists. Pattern: `◢ TITLE ─────────────── meta`.

- [ ] **Step 1: Write `dashboard/components/ui/section-header.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  meta,
  glyph = "◢",
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  glyph?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 mono-label text-muted-foreground py-2",
        className
      )}
    >
      <span aria-hidden className="text-primary">{glyph}</span>
      <span className="text-foreground">{title}</span>
      <span aria-hidden className="flex-1 border-t border-border/60" />
      {meta && <span>{meta}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/ui/section-header.tsx
git commit -m "dashboard: SectionHeader primitive"
```

---

## Task 4: StatusDot primitive

**Files:**
- Create: `dashboard/components/ui/status-dot.tsx`

- [ ] **Step 1: Write `dashboard/components/ui/status-dot.tsx`**

```tsx
import { cn } from "@/lib/utils";

type State = "idle" | "running" | "blocked";

const STATE_CLASS: Record<State, string> = {
  idle: "bg-[var(--status-idle)]",
  running: "bg-[var(--status-running)] animate-pulse",
  blocked: "bg-[var(--status-blocked)]",
};

export function StatusDot({ state, className }: { state: State; className?: string }) {
  return (
    <span
      role="status"
      aria-label={state}
      className={cn("inline-block h-1.5 w-1.5 rounded-full", STATE_CLASS[state], className)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/ui/status-dot.tsx
git commit -m "dashboard: StatusDot primitive"
```

---

## Task 5: Starfield backdrop

**Files:**
- Create: `dashboard/components/starfield.tsx`

Subtle constellation backdrop. Deterministic (seeded) so it doesn't flicker between renders. Renders 80 stars on a fixed-position SVG behind the layout.

- [ ] **Step 1: Write `dashboard/components/starfield.tsx`**

```tsx
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Starfield({ count = 80, seed = 1729 }: { count?: number; seed?: number }) {
  const rand = mulberry32(seed);
  const stars = Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: rand() * 1.2 + 0.2,
    a: rand() * 0.6 + 0.15,
  }));
  return (
    <svg
      aria-hidden
      className="fixed inset-0 w-screen h-screen -z-10 pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.1} fill="var(--star-color)" opacity={s.a} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/starfield.tsx
git commit -m "dashboard: Starfield backdrop"
```

---

## Task 6: Top header bar

**Files:**
- Create: `dashboard/components/header.tsx`

Renders `AGENTICOS · MMXXVI` brand stamp with `· IDLE` status dot, a tiny nav row, and a thin divider under it. Matches the reference's top brand line and the site's uppercase-nav vibe.

- [ ] **Step 1: Write `dashboard/components/header.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";

export function Header({ running }: { running: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-base font-semibold tracking-widest">
          AGENTICOS<span className="text-primary"> · </span>MMXXVI
        </span>
        <Pill tone="muted" glyph="·">{running ? "RUNNING" : "IDLE"}</Pill>
      </div>
      <nav className="flex items-center gap-4 mono-label text-muted-foreground">
        <Link href="/" className="hover:text-foreground">VAULT</Link>
        <Link href="/analytics" className="hover:text-foreground">ANALYTICS</Link>
        <Link href="https://www.tirtheshjani.com" target="_blank" className="hover:text-foreground">SITE ↗</Link>
        <StatusDot state={running ? "running" : "idle"} />
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/header.tsx
git commit -m "dashboard: top header with MMXXVI stamp and idle indicator"
```

---

## Task 7: Wire Starfield and Header into the page

**Files:**
- Modify: `dashboard/app/page.tsx`

The Header needs the `running` flag, which currently lives inside Workbench. Hoist a tiny piece of state — leave Workbench as a client component that accepts an `onRunningChange` callback OR keep page.tsx server-rendered and accept that the header renders `IDLE` until a future task wires real state. Pick the simpler path now: render `IDLE` statically.

- [ ] **Step 1: Rewrite `dashboard/app/page.tsx`**

```tsx
import { ForecastCard } from "@/components/forecast-card";
import { Header } from "@/components/header";
import { RecentRunsCard } from "@/components/recent-runs-card";
import { Starfield } from "@/components/starfield";
import { UsageCard } from "@/components/usage-card";
import { VaultRecentCard } from "@/components/vault-recent-card";
import { VaultSearchCard } from "@/components/vault-search-card";
import { Workbench } from "@/components/workbench";
import { loadSkills } from "@/lib/skills-loader";

export const dynamic = "force-dynamic";

export default function Page() {
  const skills = loadSkills();
  return (
    <>
      <Starfield />
      <Header running={false} />
      <main className="grid grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-[calc(100dvh-3rem)]">
        <Workbench skills={skills} />
        <aside className="space-y-3 overflow-y-auto">
          <UsageCard />
          <RecentRunsCard />
          <VaultRecentCard />
          <VaultSearchCard />
          <ForecastCard />
        </aside>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify** — `npm run dev`, refresh. The header sits at the top, starfield is faintly visible behind cards, three-column grid is unchanged.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "dashboard: wire starfield and header into page shell"
```

---

## Task 8: Branch family mapping in skills-loader

**Files:**
- Create: `dashboard/lib/branches.ts`
- Modify: `dashboard/lib/skills-loader.ts`

The architecture defines three branch families: foundation, capability, project. Skills-loader currently groups by raw folder path. Add a small mapping so the rail can render three top-level sections matching `product/architecture.md`.

- [ ] **Step 1: Create `dashboard/lib/branches.ts`**

```ts
export type BranchFamily = "foundation" | "capability" | "project";

export type BranchMeta = {
  family: BranchFamily;
  label: string;
  order: number;
};

const BRANCH_BY_DOMAIN_ROOT: Record<string, BranchMeta> = {
  _meta: { family: "foundation", label: "META", order: 0 },
  productivity: { family: "foundation", label: "PRODUCTIVITY", order: 1 },
  business: { family: "foundation", label: "PRODUCTIVITY", order: 1 },
  "healthcare-ai": { family: "capability", label: "HEALTHCARE-AI", order: 10 },
  aiml: { family: "capability", label: "AI / ML PROJECT WORK", order: 11 },
  physics: { family: "capability", label: "PHYSICS / ASTRONOMY", order: 12 },
  research: { family: "capability", label: "RESEARCH", order: 13 },
  coding: { family: "capability", label: "CODING", order: 14 },
  content: { family: "capability", label: "CONTENT", order: 15 },
  career: { family: "capability", label: "CAREER", order: 16 },
  networking: { family: "capability", label: "NETWORKING", order: 17 },
};

const FALLBACK: BranchMeta = { family: "capability", label: "OTHER", order: 99 };

export function branchFor(domain: string): BranchMeta {
  const root = domain.split("/")[0];
  return BRANCH_BY_DOMAIN_ROOT[root] ?? FALLBACK;
}

export const FAMILY_ORDER: BranchFamily[] = ["foundation", "capability", "project"];

export const FAMILY_LABEL: Record<BranchFamily, string> = {
  foundation: "FOUNDATIONS · always on",
  capability: "CAPABILITIES · modular",
  project: "PROJECTS · long-running",
};
```

Note: `business/inbox-triage`, `business/calendar-prep`, `business/weekly-rollup` currently live under the `business/` folder but belong to PRODUCTIVITY per architecture. The mapping above routes the whole `business` folder to PRODUCTIVITY. When the new venture-focused `business/*` skills are authored as stubs (per architecture), they will need to live in a separate folder (e.g. `ventures/`) OR get an explicit `metadata.branch: capability` override in their SKILL.md frontmatter. Document this in the commit; do not solve here.

- [ ] **Step 2: Extend `dashboard/lib/skills-loader.ts` with branch metadata**

Modify the `Skill` type and `loadSkills` to attach branch info. Replace the existing file content with:

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { branchFor, type BranchMeta } from "./branches";
import { skillsPath } from "./paths";

export type SkillFrontmatter = {
  name: string;
  description: string;
  license?: string;
  "allowed-tools"?: string;
  metadata?: Record<string, unknown>;
};

export type Skill = {
  name: string;
  description: string;
  folder: string;
  status: "stub" | "authored";
  domain: string;
  branch: BranchMeta;
  cadence?: "M" | "L" | "R" | "A";
  mode?: string;
  mcpServer?: string;
  externalApis?: string[];
  outputs?: string[];
  isMeta: boolean;
};

function walkSkillMd(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkSkillMd(full, acc);
    else if (e.isFile() && e.name === "SKILL.md") acc.push(full);
  }
  return acc;
}

export function loadSkills(): Skill[] {
  const files = walkSkillMd(skillsPath);
  const skills: Skill[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as SkillFrontmatter;
    if (!fm.name || !fm.description) continue;
    const folder = path.relative(skillsPath, path.dirname(file));
    const meta = (fm.metadata ?? {}) as Record<string, unknown>;
    const isMeta = folder.startsWith("_meta");
    const domain =
      (meta.domain as string) ??
      (isMeta ? "_meta" : folder.split(path.sep).slice(0, -1).join("/"));
    skills.push({
      name: fm.name,
      description: fm.description,
      folder,
      status: (meta.status as "stub" | "authored") ?? "authored",
      domain,
      branch: branchFor(domain || folder.split(path.sep)[0]),
      cadence: (meta.cadence as Skill["cadence"]) ?? undefined,
      mode: meta.mode as string | undefined,
      mcpServer: meta["mcp-server"] as string | undefined,
      externalApis: meta["external-apis"] as string[] | undefined,
      outputs: meta.outputs as string[] | undefined,
      isMeta,
    });
  }
  return skills.sort((a, b) => {
    const ord = a.branch.order - b.branch.order;
    return ord !== 0 ? ord : a.folder.localeCompare(b.folder);
  });
}

export function skillsByDomain(skills: Skill[]) {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const key = s.domain;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
```

- [ ] **Step 3: Verify type-check passes** — `cd dashboard && npx tsc --noEmit`. No errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/branches.ts dashboard/lib/skills-loader.ts
git commit -m "dashboard: branch family mapping on Skill"
```

---

## Task 9: Skills rail — group by branch family

**Files:**
- Modify: `dashboard/components/skills-rail.tsx`

Render three sections (FOUNDATIONS / CAPABILITIES / PROJECTS) using `SectionHeader`. Within each section, group by branch label. Each skill row shows a cadence pill (when set) and a status pill.

- [ ] **Step 1: Overwrite `dashboard/components/skills-rail.tsx`**

```tsx
"use client";

import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FAMILY_LABEL, FAMILY_ORDER, type BranchFamily } from "@/lib/branches";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/skills-loader";

type Props = {
  skills: Skill[];
  selected: string | null;
  onSelect: (slug: string) => void;
};

export function SkillsRail({ skills, selected, onSelect }: Props) {
  const byFamily = new Map<BranchFamily, Map<string, Skill[]>>();
  for (const fam of FAMILY_ORDER) byFamily.set(fam, new Map());
  for (const s of skills) {
    const fam = byFamily.get(s.branch.family)!;
    if (!fam.has(s.branch.label)) fam.set(s.branch.label, []);
    fam.get(s.branch.label)!.push(s);
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-2 py-2 space-y-4">
        {FAMILY_ORDER.map((fam) => {
          const groups = byFamily.get(fam)!;
          if (groups.size === 0) return null;
          return (
            <section key={fam}>
              <SectionHeader title={FAMILY_LABEL[fam]} />
              {[...groups.entries()].map(([label, list]) => (
                <div key={label} className="mb-3">
                  <div className="mono-label text-muted-foreground px-2 py-1">{label}</div>
                  <div className="space-y-0.5">
                    {list.map((s) => (
                      <button
                        key={s.folder}
                        onClick={() => onSelect(s.name)}
                        className={cn(
                          "w-full text-left rounded-sm px-2 py-1.5 text-xs font-mono transition-colors",
                          "hover:bg-accent/20 hover:text-foreground",
                          selected === s.name && "bg-accent/30 text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{s.name}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {s.cadence && <Pill tone="muted">{s.cadence}</Pill>}
                            {s.status === "stub" && <Pill tone="muted">STUB</Pill>}
                            {s.status === "authored" && <Pill tone="good">READY</Pill>}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 2: Verify in browser** — `npm run dev`, refresh. Skills rail shows two sections (FOUNDATIONS, CAPABILITIES); PROJECTS will be empty until projects are surfaced as skills (out of scope for this plan). Domains within each family appear as subheaders.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/skills-rail.tsx
git commit -m "dashboard: skills rail grouped by branch family"
```

---

## Task 10: Usage card restyle

**Files:**
- Modify: `dashboard/components/usage-card.tsx`

Drop the shadcn Card wrapper in favor of a bare bordered div with SectionHeader, two bars with brand-blue fill, and bracketed pills for the right-hand counters.

- [ ] **Step 1: Overwrite `dashboard/components/usage-card.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";

type Window = { used: number; limit: number; resets_at: string | null };
type Usage =
  | { available: false; five_hour: null; weekly: null }
  | { available: true; five_hour: Window; weekly: Window };

export function UsageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        const j: Usage = await res.json();
        if (!cancelled) setUsage(j);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="USAGE" meta={<Pill tone="muted">LIVE</Pill>} />
      {!usage && <div className="text-xs text-muted-foreground">Loading…</div>}
      {usage && !usage.available && (
        <div className="text-xs text-muted-foreground">No ~/.claude/usage.json found.</div>
      )}
      {usage && usage.available && (
        <div className="space-y-2 mt-1">
          <Bar label="5-HOUR" w={usage.five_hour} resets={resetsLabel(usage.five_hour.resets_at)} />
          <Bar label="WEEKLY" w={usage.weekly} resets={resetsLabel(usage.weekly.resets_at)} />
        </div>
      )}
    </div>
  );
}

function Bar({ label, w, resets }: { label: string; w: Window; resets: string }) {
  const pct = w.limit > 0 ? Math.min(100, (w.used / w.limit) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mono-label">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground">
            {w.used}/{w.limit}
          </span>
          <Pill tone="muted" glyph="·">{resets}</Pill>
        </span>
      </div>
      <div className="h-1 w-full bg-muted rounded-sm mt-1 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function resetsLabel(iso: string | null): string {
  if (!iso) return "RESETS · —";
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff < 0) return "RESETS · NOW";
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "RESETS · <1H";
  if (h < 24) return `RESETS · ${h}H`;
  return `RESETS · ${Math.round(h / 24)}D`;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/usage-card.tsx
git commit -m "dashboard: usage card with pills and brand-blue fills"
```

---

## Task 11: Recent runs restyle

**Files:**
- Modify: `dashboard/components/recent-runs-card.tsx`

Match the reference screenshot's time-prefix list: `HH:MM  SKILL-NAME`. Use monospace and drop the badge in favor of a tiny status dot at the start.

- [ ] **Step 1: Overwrite `dashboard/components/recent-runs-card.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusDot } from "@/components/ui/status-dot";

type Run = {
  id: number;
  skill_slug: string;
  status: "queued" | "running" | "done" | "error";
  started_at: number;
  duration_ms: number | null;
};

export function RecentRunsCard() {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled) setRuns(j.runs ?? []);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="RECENT RUNS" />
      {runs.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">No runs yet.</div>
      )}
      <ul className="space-y-0.5 mt-1">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center gap-2 font-mono text-xs">
            <StatusDot state={dotFor(r.status)} />
            <span className="text-muted-foreground">{hhmm(r.started_at)}</span>
            <span className="truncate">{r.skill_slug}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function dotFor(s: Run["status"]): "idle" | "running" | "blocked" {
  if (s === "running") return "running";
  if (s === "error") return "blocked";
  return "idle";
}

function hhmm(ts: number): string {
  const d = new Date(ts);
  const h = `${d.getHours()}`.padStart(2, "0");
  const m = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/recent-runs-card.tsx
git commit -m "dashboard: recent runs time-prefix monospace list"
```

---

## Task 12: Prompt panel hero empty state

**Files:**
- Modify: `dashboard/components/prompt-panel.tsx`

When no skill is selected, show a centered "RUN A SKILL TO BEGIN" hero (matches the reference). When a skill is selected, fall back to today's layout.

- [ ] **Step 1: Overwrite `dashboard/components/prompt-panel.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { Skill } from "@/lib/skills-loader";

type Props = {
  skill: Skill | null;
  userInput: string;
  onUserInput: (v: string) => void;
  onRun: () => void;
  running: boolean;
};

export function PromptPanel({ skill, userInput, onUserInput, onRun, running }: Props) {
  if (!skill) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
        <Pill tone="muted">READY</Pill>
        <h2 className="font-mono text-2xl tracking-wider">
          RUN A <span className="text-primary">SKILL</span> TO BEGIN
        </h2>
        <p className="text-xs text-muted-foreground">
          click a skill · press run · or type any prompt
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="mono-label text-muted-foreground">SELECTED</div>
          <div className="font-mono text-sm text-foreground">{skill.name}</div>
        </div>
        <span className="flex items-center gap-1">
          {skill.cadence && <Pill tone="muted">{skill.cadence}</Pill>}
          {skill.status === "stub" && <Pill tone="muted">STUB</Pill>}
          {skill.status === "authored" && <Pill tone="good">READY</Pill>}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3">{skill.description}</p>
      <div>
        <label htmlFor="user-input" className="mono-label text-muted-foreground">
          INPUTS · optional
        </label>
        <textarea
          id="user-input"
          value={userInput}
          onChange={(e) => onUserInput(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
          placeholder={`inputs for ${skill.name}…`}
          disabled={running}
        />
      </div>
      <Button onClick={onRun} disabled={running} aria-busy={running}>
        {running ? "RUNNING…" : "RUN"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npm run dev`, refresh. With no skill selected, see the centered hero. Click a skill, see the populated layout with cadence + status pills.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/prompt-panel.tsx
git commit -m "dashboard: prompt panel hero empty state"
```

---

## Task 13: Vault recent / search / forecast restyle

**Files:**
- Modify: `dashboard/components/vault-recent-card.tsx`
- Modify: `dashboard/components/vault-search-card.tsx`
- Modify: `dashboard/components/forecast-card.tsx`

Strip the shadcn Card wrapper, apply the same bordered-div + SectionHeader pattern as usage and recent runs. Keep all internal logic.

- [ ] **Step 1: Overwrite `dashboard/components/vault-recent-card.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

type Change = { id: number; path: string; kind: string; ts: number };

export function VaultRecentCard() {
  const [changes, setChanges] = useState<Change[]>([]);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/vault/recent", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled) setChanges(j.changes ?? []);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="VAULT · RECENT" />
      {changes.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">No changes yet.</div>
      )}
      <ul className="space-y-0.5 mt-1">
        {changes.map((c) => (
          <li key={c.id} className="text-xs font-mono truncate">
            <span className="text-muted-foreground">{c.kind} </span>{c.path}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Overwrite `dashboard/components/vault-search-card.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

type Hit = { path: string; score: number; snippet: string };

export function VaultSearchCard() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setHits([]); setReason(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/vault/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { hits: Hit[]; reason?: string };
      setHits(data.hits ?? []);
      setReason(data.reason ?? null);
    } catch {
      setHits([]); setReason("search failed");
    } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => run(q), 250);
    return () => clearTimeout(id);
  }, [q, run]);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="VAULT · SEARCH" />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search vault markdown..."
        className="w-full text-xs px-2 py-1 rounded-sm border border-border bg-background font-mono mt-1"
      />
      {searching && <div className="text-xs text-muted-foreground mt-1">Searching…</div>}
      {!searching && q.trim().length >= 2 && hits.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">{reason ?? "No matches."}</div>
      )}
      <div className="space-y-1.5 max-h-64 overflow-y-auto mt-1">
        {hits.map((h) => (
          <div key={h.path} className="text-xs space-y-0.5">
            <div className="font-mono truncate" title={h.path}>{h.path}</div>
            <div className="text-muted-foreground line-clamp-2">{h.snippet}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Overwrite `dashboard/components/forecast-card.tsx`**

```tsx
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { loadSchedules } from "@/lib/schedules";

export function ForecastCard() {
  const specs = loadSchedules();
  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="FORECAST · ROUTINES" meta={<Pill tone="muted">{specs.length}</Pill>} />
      {specs.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">No remote schedules registered.</div>
      )}
      <ul className="space-y-1 mt-1">
        {specs.map((s) => (
          <li key={s.file} className="text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2 font-mono">
              <span className="truncate">{s.skill}</span>
              <span className="text-muted-foreground shrink-0">{s.relativeText}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground font-mono">
              <span className="truncate">{s.cron}</span>
              <span className="shrink-0">{s.absoluteText}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Verify all three cards render** — `npm run dev`. Right rail should now read as one consistent terminal-style list of sections separated by the `◢ TITLE` divider.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/vault-recent-card.tsx dashboard/components/vault-search-card.tsx dashboard/components/forecast-card.tsx
git commit -m "dashboard: vault/forecast cards apply section header + mono treatment"
```

---

## Task 14: Final pass — validate, lint, screenshot

**Files:**
- No code changes; verification only.

- [ ] **Step 1: Run validators** — From repo root, `cd dashboard && npm run validate:skills && npm run validate:automations && npm run lint`. All exit 0.

- [ ] **Step 2: Dev server smoke** — `npm run dev`, open `http://localhost:3000`. Confirm:
    - Header reads `AGENTICOS · MMXXVI` with `[· IDLE]` pill
    - Starfield faintly visible behind cards (look near the corners)
    - Skills rail shows FOUNDATIONS → CAPABILITIES sections with subheaders for each domain
    - Centered hero "RUN A SKILL TO BEGIN" when nothing selected
    - Usage bars are brand-blue
    - Recent runs as time-prefix mono list
    - All right-rail cards use the `◢ TITLE` section header
    - No light-mode flash on reload

- [ ] **Step 3: Cross-check the architecture file** — Confirm `product/architecture.md` matches the rail's groupings. Any skill that lands in OTHER means its domain root isn't mapped in `dashboard/lib/branches.ts` — add it.

- [ ] **Step 4: Final commit** — only if any tweaks were made in Step 3.

```bash
git add -A dashboard/
git commit -m "dashboard: polish pass complete"
```

---

## Out of scope for this plan (follow-on work)

These were considered and deferred:

1. **Quick-action tabs** (`CLAUDE CODE / VAULT / DAILY NOTE / RUNS FOLDER / DRAFTS` in the reference) — would need new routes and OS file-opener hooks; defer.
2. **30D cumulative activity chart** — analytics page already exists at `/analytics`; building a top-of-dashboard chart duplicates that. Revisit if you want it as a hero instead of a click-through.
3. **Integrations strip** — would need a registry of connected MCP servers and live health checks. Author a separate plan once the MCP server list stabilizes.
4. **PROJECTS row population** — the skills rail's PROJECTS family will stay empty until projects become a first-class entity with their own loader (analogous to `loadSkills`). Author a separate plan when you want this surfaced.
5. **Live running indicator in Header** — currently statically `IDLE`. Wire to a global running-state context once Workbench's running state is hoisted.
6. **Authoring the stub skills** named in `product/architecture.md` (`healthcare-ai/*`, `aiml/*`, `physics/*`, `business/*`, `career/*`, `networking/*`) — use `/new-skill` per skill; not part of the dashboard polish.

## Theme reference

| Token         | Value (approximate)              | From                                |
|---------------|----------------------------------|-------------------------------------|
| Background    | `oklch(0.13 0.02 250)`           | tirtheshjani.com "dark sky"         |
| Foreground    | `oklch(0.96 0.01 250)`           | high-contrast white                 |
| Primary/Accent| `oklch(0.68 0.18 250)`           | tirtheshjani.com "brand blue"       |
| Star color    | `oklch(0.7 0.05 250 / 0.5)`      | constellation/starfield motif       |
| Year stamp    | `MMXXVI`                         | site's "PORTFOLIO / MMXXVI" pattern |
| Heading case  | UPPERCASE + tracking-wider       | site's uppercase nav labels         |
| Font (mono)   | Geist Mono (already loaded)      | terminal pill + label aesthetic     |

Replace the approximate oklch values in Task 1, Step 2 with exact ones extracted via DevTools from tirtheshjani.com before merging.
