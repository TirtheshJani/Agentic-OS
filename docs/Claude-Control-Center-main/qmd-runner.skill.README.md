# qmd-runner

Use the repo-local `qmd` runner from the Claude Control Center root to execute shell commands stored in markdown files.

## Run a `.qmd` file

From the repo root:

```sh
./qmd list qmd-examples/project-health.qmd
./qmd run qmd-examples/project-health.qmd
./qmd run qmd-examples/project-health.qmd backend-routes
npm run qmd -- run qmd-examples/dev-checks.qmd --dry-run
```

## Define commands in markdown

Write fenced shell code blocks in markdown and optionally assign a stable block name and working directory:

~~~md
## Frontend Build

```bash qmd:name=frontend-build cwd=../frontend
npm run build
```
~~~

- Supported fence languages: `bash`, `sh`, `shell`, `zsh`
- `qmd:name=...` assigns the block name used with `./qmd run <file> <block-name>`
- `cwd=...` is resolved relative to the `.qmd` file location

## Claude Control Center patterns

- `qmd-examples/project-health.qmd`: inspect backend routes and frontend scripts
- `qmd-examples/dev-checks.qmd`: run frontend build and backend compile checks
- For new automation, keep one task per heading and use explicit `qmd:name=...` labels so Codex can call a single block without executing the whole file

## Notes

The upstream repository referenced in the task, `https://github.com/tobi/qmd`, currently describes a Bun-based markdown search/indexing CLI rather than a markdown command runner. This skill documents the repo-local runner added to Claude Control Center for `.qmd` task automation.
