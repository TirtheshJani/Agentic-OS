---
title: Projects
---

# vault/projects/

One folder per project. Each folder has a `PROJECT.md` with frontmatter the dashboard projects-loader reads.

## Frontmatter schema

```yaml
---
name: <slug>             # required, kebab-case
slug: <slug>             # required, must match folder name
description: <one line>  # required
status: active | dormant | archived
branch: meta | productivity | research | physics | healthcare-ai | aiml | quantum | content | career | coding | other
path: <absolute or relative path>   # working directory used when running skills against this project
repo-url: <https URL or "">         # optional
capabilities: [list, of, capability, branches]
agent: general-purpose | Plan | Explore | <other Task-tool subagent_type>
---
```

A project's `path` becomes the working directory for runs. Claude Code automatically picks up the nearest `CLAUDE.md` walking up from `path`, so no explicit `claude-md` field is required.

## Adding a project

1. Create `vault/projects/<slug>/PROJECT.md` with the frontmatter above.
2. Restart the dashboard dev server or wait for the next page reload — projects are loaded on each request.
3. The project appears in the rail under PROJECTS · long-running.

## Active surface

Active projects with their canonical path appear first in the rail. Dormant projects stay visible but appear muted.
