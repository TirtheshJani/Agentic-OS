# Domain glossary

Source of truth for Agentic OS domain vocabulary (spec 0031, ADR-024).
Parsed by `dashboard/lib/glossary.ts` into a budget-capped context block
injected into agent context at spawn, and read by the ADR-007 router so an
alias scores the same as its canonical term.

Line format, one term per line:

    - **term** (alias1, alias2): definition

The aliases group is optional. A line without `(...)` is still valid:

    - **term**: definition

Edit this file directly; there is no editor UI. Keep definitions to one line.

## Terms

- **run** (session): one interactive CLI session in a PTY against a single issue, spawned on a runtime, streamed to the browser, recorded as a row with its model, status, and worktree.
- **issue** (task, ticket): one unit of work on the kanban; the agent reads its body, may carry an acceptance contract and a why line, and moves through queued, running, review, and done.
- **epic** (mission): a first-class grouping above issues that owns a shared contract and a milestone and rolls up status from its children's grades.
- **agent** (teammate, member): a `<slug>.md` profile with a description, runtime, optional model, and skills; the description is also the routing signal the scorer matches an issue against.
- **runtime** (cli): the coding CLI a run spawns into (claude-code, gemini-cli, antigravity-cli), each declaring honest capability flags for hooks, session resume, and transcript parsing.
- **worktree**: the per-issue git worktree a run owns, an isolated checkout that bounds the blast radius and holds the run's HANDOFF.md.
- **skill**: a folder with a SKILL.md describing what to do and when; agents invoke skills, and an automation drives exactly one skill.
- **automation** (job): a recurring task; local ones are shell scripts the operator runs, remote ones are markdown cron specs the in-dashboard scheduler files as issues.
- **vault** (memory): the Obsidian markdown store indexed into SQLite for search, the graph, the inbox, and RAG answers; agents write durable artifacts there by absolute path.
- **orchestrator** (router): the deterministic ADR-007 scorer that matches a queued issue to the best lead agent by domain-term, synonym, and skill-name hits.
- **judge** (eval, grader): the optional LLM that grades a finished run against a rubric or per-assertion contract, double-gated behind autoGrade and the autonomy switch.
- **handoff**: a child issue POSTed to the local API with a parent link, the HTTP mechanism that chains agents instead of parsing stdout.
- **autonomy**: the global kill switch, off by default, that gates every unattended path (scheduler fires, auto-grading, handoffs).
