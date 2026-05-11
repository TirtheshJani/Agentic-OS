---
name: memory-curator
description: Synchronize vault knowledge to an Anthropic Memory Store, enabling persistent cross-session learning. Reads recent vault/raw/daily/ notes and vault/wiki/ pages, creates or updates topical memory files, and optionally triggers a Dream job to consolidate and deduplicate. Use when asked to "sync memory", "update agent memory", "run memory curator", "consolidate vault knowledge", or "archive to memory store". Requires ANTHROPIC_API_KEY.
license: MIT
allowed-tools: Read Write Bash
metadata:
  status: authored
  domain: _meta
  mode: local
  mcp-server: none
  external-apis: [anthropic-memory-api]
  outputs: [vault/projects/memory-curator/state.json]
---

# Memory Curator

Bridges the Agentic-OS vault (where skills write their outputs) with the Anthropic
Managed Agents Memory API, enabling true persistent cross-session knowledge
accumulation and automated consolidation via Dreams.

## Prerequisites

`ANTHROPIC_API_KEY` must be set in the environment. The Memory and Dreams APIs
require the `managed-agents-2026-04-01` beta header (handled by the script).

```bash
# Verify key is set
echo $ANTHROPIC_API_KEY | head -c 20
# Install SDK if needed
pip install anthropic
```

## Instructions

This skill uses the **sequential workflow** pattern.

### Step 1: Check prerequisites

Verify `ANTHROPIC_API_KEY` is set and `anthropic` SDK is installed. If either
is missing, stop and report the exact setup step needed.

### Step 2: Run the sync script

```bash
python skills/_meta/memory-curator/scripts/memory_curator.py \
  --days 7 \
  --vault-path vault
```

Default: syncs last 7 days of daily notes + all wiki pages.

Override the window: `--days 14` for a two-week sync.

### Step 3: Inspect the output

The script prints:
- Which memory store ID is being used (created or existing)
- Which memory files were created/updated and their sizes
- The state file path where the store ID is persisted

Report these to the user verbatim. The memory store ID is the key artifact —
the user will need it to attach the store to future Managed Agent sessions.

### Step 4: Optionally trigger a Dream

If the user asked to "consolidate" or "deduplicate" memory, or if this is a
scheduled weekly run, add the `--dream` flag:

```bash
python skills/_meta/memory-curator/scripts/memory_curator.py \
  --days 30 \
  --dream \
  --vault-path vault
```

Dreams run asynchronously and take 2–20 minutes. The script polls every 10s
up to 5 minutes. If it times out, the dream is still running — check the
output store ID in state.json after waiting.

### Step 5: Confirm state saved

Verify `vault/projects/memory-curator/state.json` was written with the
`memory_store_id` and `last_sync` timestamp. Report the store ID to the user.

## Inputs

| Input | Description | Default |
|---|---|---|
| `--days N` | Days of daily notes to include | 7 |
| `--dream` | Trigger Dream consolidation after sync | off |
| `--vault-path PATH` | Path to vault directory | `vault` |

## Memory Store Layout

```
/vault/daily-activity.md    recent daily notes (last N days)
/vault/wiki-knowledge.md    all wiki pages snapshot
```

Each file is capped at 90 KB to stay under the 100 KB Memory API limit.

## Outputs

- `vault/projects/memory-curator/state.json` — persists `memory_store_id`
  and `last_sync` timestamp across invocations
- Anthropic Memory Store files (remote, not in vault)

## Examples

**Weekly sync:**
> "Run memory curator for the last week"
→ `python ...memory_curator.py --days 7`

**Monthly consolidation with dream:**
> "Sync and consolidate the last month of vault notes into memory"
→ `python ...memory_curator.py --days 30 --dream`

**Check what's in the store:**
> After sync, the script reports each memory file path and size.
> The store ID can be used directly with the Anthropic API to read memory files.

## Troubleshooting

**`ANTHROPIC_API_KEY` not set:**
Add to `.env.local` and source it, or export inline:
`ANTHROPIC_API_KEY=sk-ant-... python ...memory_curator.py`

**`anthropic` module not found:**
`pip install anthropic` (version ≥0.40.0 for Memory API support)

**Memory store not found (404 on update):**
Delete `vault/projects/memory-curator/state.json` to force creation of a new store.

**Dream times out after 5 min:**
The dream is still running on Anthropic's side. Run `--dream` again without
`--days` (it will reuse the existing store), or check the Anthropic platform
dashboard for dream job status.

**Memory API returns 400 / beta header error:**
The Memory API requires `anthropic-beta: managed-agents-2026-04-01`. This is
set automatically by the script. If you see this error, update the SDK:
`pip install --upgrade anthropic`

## Using the Memory Store in Future Sessions

To attach this store to a Managed Agents session:

```python
import anthropic

client = anthropic.Anthropic()
session = client.beta.sessions.create(
    agent_id="<your-agent-id>",
    resources=[{
        "type": "memory_store",
        "memory_store_id": "<store-id-from-state.json>",
        "access": "read_write",
    }],
)
```

The agent then reads and writes memory at `/mnt/memory/vault/daily-activity.md` etc.
