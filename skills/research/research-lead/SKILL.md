---
name: research-lead
description: Read the research-department queue, pick a teammate per task based on skill overlap, claim and reassign. Use when the dashboard 'Tick' button fires the research lead loop, or the user says "tick research", "route research queue", "claim research tasks".
license: MIT
allowed-tools: "Read Write WebFetch Bash"
metadata:
  status: authored
  domain: research
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: research-lead
  department: research
  role: lead
---

# Research lead — routing instructions

## Inputs

This skill is invoked by `POST /api/lead/tick` with body `{department: "research"}`.
The spawned `claude -p` receives:

- Append-system-prompt: `agents/_prompts/research-lead.md`
- User prompt: a JSON dump of the current queue, formatted as:

  ```
  {
    "tick_at": "2026-05-14T10:00:00Z",
    "pending": [
      { "id": 12, "prompt": "…", "created_at": …, "department": "research" }
    ]
  }
  ```

## Instructions

1. Parse the JSON queue from the user message.
2. For each pending task:
   1. Read the prompt text.
   2. Read `agents/research/*.md` profiles to enumerate teammates. For each,
      record `name`, `description`, and `allowed-skills`. (Use the Read tool
      with explicit paths; do not glob outside `agents/research/`.)
   3. Score each teammate against the prompt with this rubric:
      - 3 points: a domain noun in the prompt appears verbatim in the
        teammate's `description` (e.g. prompt "FDA clearance" matches a
        description containing "FDA").
      - 2 points: a domain synonym is present (e.g. prompt "NIH guidance"
        matches "regulatory standards" in the description).
      - 1 point: any `allowed-skills` name appears as a substring of the
        prompt (case-insensitive).
      - 0 points otherwise.
      Sum across all matches. Highest total wins; ties broken alphabetically.
   4. If best score is 0, leave the task queued and append to its thread:
      `no teammate matched — holding`
   5. Otherwise:
      - POST to `http://localhost:3000/api/tasks/{id}/claim` with body
        `{"assignee": "<teammate-name>"}`. Use the Bash tool with curl.
      - Append a one-line decision to `vault/threads/<task-id>.md` via
        the Write tool. Construct this path yourself from the task's
        `id` field in the queue JSON — your tick run handles many tasks
        and the orchestrator does not set `$AGENTIC_OS_THREAD_PATH` for
        lead runs:

        ```
        [<ISO timestamp>] research-lead: assigned to <teammate> (matched: <skill>)
        ```

3. After all tasks are processed, write a one-line summary to stdout in
   the form `routed: <N> handed-off, <M> held`. Exit normally.

## Outputs

- Updates per task: thread file at `vault/threads/<task-id>.md` (append-only).
- Side effect: tasks transition from `queued` to `claimed` via API.

## Examples

Input queue with one task:

```json
{"pending":[{"id":12,"prompt":"summarize today's arxiv ML papers","department":"research"}]}
```

Expected behavior: arxiv-watcher's `description` mentions "arXiv" and its
`allowed-skills` include `paper-search` and `arxiv-daily-digest`. Prompt has
"arxiv" → 3-point match on description plus 1-point match on skill name.
Total 4. Claim to arxiv-watcher; append thread note. stdout:
`routed: 1 handed-off, 0 held`.

Input queue with a healthcare-policy task:

```json
{"pending":[{"id":17,"prompt":"research the NIH stance on FHIR-RAG and draft a Substack section","department":"research"}]}
```

Expected behavior: health-watcher's `description` names "NIH", "FHIR", and
"RAG over medical literature" → multiple 3-point matches. arxiv-watcher's
description does not mention any of these → 0 points. Claim to
health-watcher; thread note: `assigned to health-watcher (matched: NIH, FHIR)`.

## Troubleshooting

- `claim returned 409`: the task moved out of `queued` between read and write.
  Skip it and continue with the next task. Append a thread note saying
  `tick saw 409 on claim — task moved`.
- `no agents in agents/research/`: the validator should have caught this.
  Exit with stdout `error: no research agents found` and exit code 1.
