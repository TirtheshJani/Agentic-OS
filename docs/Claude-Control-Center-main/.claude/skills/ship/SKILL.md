---
name: ship
description: Run tests, verify the build, commit with a descriptive message, and open a PR referencing the related GitHub issue. Never pushes to main directly.
version: 1.0.0
user-invocable: true
argument-hint: "[issue number or description]"
---

# Ship

Ship the current working-tree changes: test → build → commit → PR. Never push directly to `main` or `master`.

## Step 1 — Confirm branch safety

Check the current branch. If it is `main` or `master`, **stop immediately** and tell the user to create a feature branch first. Do not proceed until on a non-main branch.

```sh
git branch --show-current
```

If the branch is safe, continue.

## Step 2 — Run the test suite

Run all available tests for this project. For Claude Control Center this means:

```sh
# Backend tests (if present)
cd backend && source venv/bin/activate && python -m pytest --tb=short -q 2>/dev/null || echo "No pytest tests found"

# Frontend type-check (acts as a compile-time test)
cd frontend && npx tsc --noEmit
```

If tests fail, **stop and report the failures** — do not commit broken code. Fix issues or ask the user how to proceed.

## Step 3 — Verify the build

```sh
cd frontend && npm run build
```

A clean build (exit 0, no type errors) is required. If the build fails, stop and surface the errors before going further.

## Step 4 — Identify the related GitHub issue

1. If the user passed an issue number as an argument (e.g. `/ship 42`), use that.
2. Otherwise check the branch name for an issue reference (e.g. `feat/42-my-feature` → issue 42).
3. If still unclear, run `gh issue list --state open --limit 20` and ask the user which issue this work closes.

## Step 5 — Draft the commit message

Inspect the diff to write a precise, imperative-mood commit message:

```sh
git diff --staged
git diff          # unstaged changes
git status
```

Message format:
```
<type>(<scope>): <short summary under 72 chars>

<optional body: WHY, not WHAT — one paragraph max>

Closes #<issue-number>
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

**Show the draft commit message to the user and get confirmation before committing.**

## Step 6 — Stage and commit

Stage only the relevant files (avoid `.env`, secrets, large binaries):

```sh
git add <specific files>
git commit -m "$(cat <<'EOF'
<confirmed message>
EOF
)"
```

## Step 7 — Push the branch

```sh
git push -u origin <branch-name>
```

## Step 8 — Open a pull request

Use `gh pr create`. Pull the issue title if available to seed the PR title:

```sh
gh pr create \
  --title "<type>(<scope>): <summary>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet points from the commit>

## Test plan
- [ ] Tests pass (`npx tsc --noEmit` + pytest)
- [ ] Build succeeds (`npm run build`)
- [ ] Manually verified: <what you checked>

Closes #<issue-number>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL to the user.

## Guard rails

- **Never** `git push origin main` or `git push origin master`.
- **Never** `--force` push unless the user explicitly requests it.
- **Never** skip `--no-verify` hooks — fix the underlying issue instead.
- If any step fails, stop and explain clearly before doing anything destructive.
