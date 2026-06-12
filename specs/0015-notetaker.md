# Spec 0015: Notetaker

> **Status:** Shipped. **Owner:** TJ. **Date:** 2026-06-11.

## Scope

Make the dashboard a first-class place to read, write, and capture vault
notes: a `/notes` view with an editor, `[[wikilink]]` autocomplete, and a
global quick-capture modal. Everything is plain markdown in the existing
Obsidian vault, so the indexer, graph, and RAG layer (specs 0010/0013)
see new notes with zero extra plumbing. Implementation follows the
karpathy-guidelines skill.

Out of scope: rich markdown editing (CodeMirror, live preview), note
deletion/renaming, conflict resolution beyond last-write-wins.

## Write funnel (`lib/vault/noteWriter.ts`)

All dashboard-originated vault writes go through one module:

- `createNote({folder, title, content})` — kebab-cases the title into
  the filename, refuses overwrites (the API surfaces this as a 400),
  creates intermediate directories.
- `updateNote(relPath, content)` — full-content replace; bumps the
  `updated:` frontmatter field when one exists.
- `appendToDaily(text)` — appends `- HH:MM — text` to
  `raw/daily/YYYY-MM-DD.md`, creating the file with daily frontmatter on
  first capture of the day.
- `suggestNotes(q)` — prefix match on basename and title against the
  SQLite notes index, for `[[wikilink]]` autocomplete
  (`GET /api/vault/suggest?q=`).

Every write runs `indexVault()` synchronously and publishes
`vault.indexed`. Rationale: the chokidar watcher debounces 1.5s, which
is long enough for a just-created note to be missing from the list the
UI refreshes; the watcher's later full rebuild is idempotent, so the
double index is harmless.

### Folder allowlist and guards

Notes may only be created under the top-level folders `raw`, `wiki`,
`projects`, `outputs`, `learning`, `research`. Paths are normalized,
`..` is rejected, and every resolved path is asserted to be inside
`VAULT_DIR`. Filenames are kebab-case per
`standards/vault-conventions.md` (no spaces, no capitals).

### Frontmatter templates

When the submitted content has no frontmatter, `createNote` prepends a
template matching `standards/vault-conventions.md` (plus a `# Title`
heading when the content has none):

- `raw/daily/*`: `date`, `domain: []`, `source: dashboard`
- `wiki/<domain>/*`: `domain` (derived from the folder), `source:
  dashboard`, `created`, `updated`, `tags: []`
- everything else: `source: dashboard`, `created`

## API

- `GET /api/vault/list?folder=` → `{notes: [{path, title, folder,
  mtime}], folders: string[]}` — newest first, 500 cap.
- `GET /api/notes?path=` → `{path, content}` (pre-existing).
- `POST /api/vault/note` `{folder, title, content}` → 201 `{relPath}`;
  400 on overwrite, traversal, or disallowed folder.
- `PUT /api/vault/note` `{path, content}` → `{ok}`.
- `POST /api/vault/daily/append` `{text}` → 201 `{relPath}`.
- `GET /api/vault/suggest?q=` → `{suggestions: [{title, path,
  basename}]}`.

## UI surfaces

- **`/notes` view** (`app/notes/page.tsx` + `components/notes/`):
  two-pane layout. Left: folder filter (populated from `folders[]`),
  note list (title + path, newest first), "New note" button. Right:
  editor. The list and the open note reload on `vault.indexed` stream
  events.
- **Editor** (`NoteEditor.tsx`): plain monospace textarea (deliberate
  v1; no CodeMirror, no preview). Dirty indicator, Save button and
  Ctrl+S, `PUT /api/vault/note` on save. While dirty, incoming
  `vault.indexed` reloads are ignored for the open note: local state is
  authoritative until saved. Typing `[[` plus at least one character
  queries `/api/vault/suggest` and shows a popover below the textarea
  (no caret pixel positioning); selecting inserts `[[basename]]` and
  closes the bracket; Escape dismisses.
- **New-note modal**: title input plus a free-text folder input
  (placeholder `raw/daily`, hint listing the allowed top-level
  folders). 400 errors render inline; success opens the created note.
- **Quick capture** (`QuickCapture.tsx`, mounted in `AppShell` so it is
  available on every page): Ctrl+Shift+K opens a modal with a textarea.
  Default action (Enter) appends to today's daily note; "Save as
  note…" expands title and folder fields and creates a standalone note.
  Success flashes the written `relPath` briefly, then closes.

## Deviations from the draft plan

- No `defaultCaptureFolder` setting. Deliberate: quick capture defaults
  to the daily note and the save-as-note path takes an explicit folder;
  a setting would be speculative configurability with no current user.
- v1 editor is a textarea. CodeMirror/markdown preview can be layered
  on later without touching the write funnel or API.

## Tests

`tests/noteWriter.test.ts` — daily/wiki frontmatter templates,
synchronous index + `vault.indexed` publish, overwrite/traversal/
disallowed-folder refusal, `updated:` bump on update, daily append
create-then-append behavior, suggest prefix matching.
