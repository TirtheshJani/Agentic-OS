# Deterministic validators

Small, pure-function scripts that skills can call instead of
re-deriving a parser or schema check every run. See
`standards/skill-authoring.md` §9 for the rule that earns a script
its place here.

| Script | What it checks | Used by |
|---|---|---|
| `validate_arxiv_atom.py` | Atom XML response shape (entries present, required per-entry fields) | `arxiv-daily-digest`, `morning-trend-scan` |
| `parse_pr_id.py` | URL / `owner/repo#num` / `#num` → `{owner, repo, num}` | `pr-review-prep` |
| `check_rubric_coverage.py` | Inbox-triage report has every rubric bucket and totals add up | `inbox-triage` |

## Conventions

- **Stdlib only.** No third-party deps; if you reach for one, the
  check is too big for this folder.
- **Stdin or argv for input, stdout for output.** Output is JSON so
  callers can consume programmatically.
- **Exit 0 = ok, exit 1 = validation failed, exit 2 = bad usage.**
- **No network.** Validators check shape; they don't fetch.

## Running by hand

```bash
# Validate a saved Atom response
python scripts/validators/validate_arxiv_atom.py /tmp/response.xml

# Parse a PR identifier
echo "tirtheshjani/agentic-os#42" | python scripts/validators/parse_pr_id.py

# Check an inbox triage report
python scripts/validators/check_rubric_coverage.py vault/wiki/business/inbox-2026-05-10.md
```

## Fixtures

`fixtures/arxiv-sample.atom.xml` — minimal but valid arXiv Atom feed
with two entries. Shape-checked by `validate_arxiv_atom.py`. Useful
when you want to develop a skill against arXiv without hitting the
network.
