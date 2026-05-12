---
name: finishing-a-development-branch
description: "Use when implementation is complete, all tests pass, and you need to decide how to integrate the work. Guides completion of development work by presenting structured options for merge, PR, or cleanup. The closing step in the engineering team workflow after TDD and verification. Trigger phrases: 'ship this', 'merge this branch', 'open a PR', 'wrap this up', 'clean up the branch', 'I'm done'."
license: MIT
allowed-tools: Bash, Read
metadata:
  status: authored
  domain: engineering
  mode: local
  mcp-server: none
  external-apis: [github-via-gh-cli]
  outputs: []
  source: https://github.com/obra/superpowers
  source-license: MIT
  source-author: Jesse Vincent
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling the chosen workflow.

**Core principle:** Verify tests, then detect environment, then present options, then execute choice, then clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run the project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**

```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** continue to Step 2.

### Step 2: Detect Environment

**Determine workspace state before presenting options:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

This determines which menu to show and how cleanup works:

| State                                          | Menu                  | Cleanup                              |
|------------------------------------------------|-----------------------|--------------------------------------|
| `GIT_DIR == GIT_COMMON` (normal repo)          | Standard 4 options    | No worktree to clean up              |
| `GIT_DIR != GIT_COMMON`, named branch worktree | Standard 4 options    | Provenance-based (see Step 6)        |
| `GIT_DIR != GIT_COMMON`, detached HEAD         | Reduced 3 options     | No cleanup (externally managed)      |

### Step 3: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main. Is that correct?"

### Step 4: Present Options

**Normal repo and named-branch worktree. Present exactly these 4 options:**

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Detached HEAD. Present exactly these 3 options:**

```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Which option?
```

**Don't add explanation.** Keep options concise.

### Step 5: Execute Choice

#### Option 1: Merge Locally

```bash
# Get main repo root for CWD safety
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# Merge first. Verify success before removing anything.
git checkout <base-branch>
git pull
git merge <feature-branch>

# Verify tests on merged result
<test command>

# Only after merge succeeds: cleanup worktree (Step 6), then delete branch.
```

Then cleanup worktree (Step 6), then delete branch:

```bash
git branch -d <feature-branch>
```

#### Option 2: Push and Create PR

```bash
# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

**Do NOT clean up worktree.** User needs it alive to iterate on PR feedback.

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**

```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Then cleanup worktree (Step 6), then force-delete branch:

```bash
git branch -D <feature-branch>
```

### Step 6: Cleanup Workspace

**Only runs for Options 1 and 4.** Options 2 and 3 always preserve the worktree.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**If `GIT_DIR == GIT_COMMON`:** normal repo, no worktree to clean up. Done.

**If worktree path is under `.worktrees/`, `worktrees/`, or `~/.config/superpowers/worktrees/`:** Superpowers (or this skill's flow) created this worktree, so we own cleanup.

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

**Otherwise:** the host environment (harness) owns this workspace. Do NOT remove it. If your platform provides a workspace-exit tool (Agentic-OS has `ExitWorktree`), use it. Otherwise, leave the workspace in place.

## Quick Reference

| Option           | Merge | Push | Keep Worktree | Cleanup Branch |
|------------------|-------|------|---------------|----------------|
| 1. Merge locally | yes   | -    | -             | yes            |
| 2. Create PR     | -     | yes  | yes           | -              |
| 3. Keep as-is    | -     | -    | yes           | -              |
| 4. Discard       | -     | -    | -             | yes (force)    |

## Common Mistakes

**Skipping test verification**
- Problem: merge broken code, create failing PR
- Fix: always verify tests before offering options

**Open-ended questions**
- Problem: "What should I do next?" is ambiguous
- Fix: present exactly 4 structured options (or 3 for detached HEAD)

**Cleaning up worktree for Option 2**
- Problem: remove worktree user needs for PR iteration
- Fix: only cleanup for Options 1 and 4

**Deleting branch before removing worktree**
- Problem: `git branch -d` fails because worktree still references the branch
- Fix: merge first, remove worktree, then delete branch

**Running `git worktree remove` from inside the worktree**
- Problem: command fails silently when CWD is inside the worktree being removed
- Fix: always `cd` to main repo root before `git worktree remove`

**Cleaning up harness-owned worktrees**
- Problem: removing a worktree the harness created causes phantom state
- Fix: only clean up worktrees under `.worktrees/`, `worktrees/`, or `~/.config/superpowers/worktrees/`

**No confirmation for discard**
- Problem: accidentally delete work
- Fix: require typed "discard" confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on the result
- Delete work without confirmation
- Force-push without explicit request
- Remove a worktree before confirming merge success
- Clean up worktrees you didn't create (provenance check)
- Run `git worktree remove` from inside the worktree

**Always:**
- Verify tests before offering options
- Detect environment before presenting menu
- Present exactly 4 options (or 3 for detached HEAD)
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 and 4 only
- `cd` to main repo root before worktree removal
- Run `git worktree prune` after removal

## Related skills

- `using-git-worktrees` (in `_meta/`) - sets up the workspace this skill cleans up
- `test-driven-development` (in `engineering/`) - the build step before finishing
- `requesting-code-review` (in `engineering/`) - get review before merging (Option 2 path)
- `verification-before-completion` (in `_meta/`) - the test-pass check that gates Step 1
