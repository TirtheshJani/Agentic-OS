# Code style

Applies to all TypeScript / React / Tailwind code in `dashboard/` and any
helper scripts in `skills/*/scripts/`.

## TypeScript

- `"strict": true` in `tsconfig.json`. No `any` without a `// FIXME` and a
  follow-up TODO in `product/roadmap.md`.
- No default exports for components, hooks, or utilities — named exports
  only. Default exports survive only where Next.js requires them
  (`page.tsx`, `layout.tsx`, route handlers).
- Prefer type-only imports: `import type { Foo } from "./foo"`.
- File naming: kebab-case for non-component files (`skills-loader.ts`),
  kebab-case for components (`skills-rail.tsx`). Internal types live next
  to their usage; don't create `types.ts` graveyards.

## React

- Server Components by default. Add `"use client"` only when a hook or
  browser API forces it (SSE consumer, vault tree expand/collapse, Run
  button).
- Mutations go through Server Actions, not hand-rolled fetch. The one
  exception is `/api/run` which is a streaming SSE endpoint.
- No third-party state library — `useReducer` + RSC is enough for this
  surface area.

## Tailwind

- Order classes via `prettier-plugin-tailwindcss`.
- Use the design tokens defined in `dashboard/app/globals.css`. Don't
  hardcode hex colors in components.
- Layout primitives: `grid`, `gap-*`, `min-h-*`. No CSS modules.

## SQL (better-sqlite3)

- Prepared statements only. Never string-interpolate user input.
- Migrations in `lib/db.ts` — idempotent `CREATE TABLE IF NOT EXISTS`.

## Errors

- At system boundaries (HTTP, child-process spawn, file I/O), catch and
  return a typed error response. Internally, throw — don't pre-emptively
  validate things the type system already proves.
- No silent fallbacks. If a skill fails to load, surface it.

## Comments

- Default to none. Names + types are the documentation.
- Write a comment only when the **why** is non-obvious: a workaround, an
  invariant, a constraint imposed from outside the file.
