# Validators

Deterministic, stdlib-only Python validators that skills call instead
of re-deriving parsers/checkers every run.

Each script:
- Reads from stdin or argv.
- Writes a single JSON object to stdout.
- Exits 0 on success, 1 on validation failure, 2 on usage/internal error.
- Has no external dependencies — `python3` is enough.

## Scripts

| Script | Used by | Purpose |
|---|---|---|
| `validate_arxiv_atom.py` | arxiv-daily-digest, morning-trend-scan, healthcare-arxiv | Confirm an arXiv Atom payload parses and has the expected entry shape |
| `parse_pr_id.py` | pr-review-prep | Normalize a PR reference (URL, owner/repo#N, bare #N + env, garbage) to `{owner, repo, number}` |
| `check_rubric_coverage.py` | inbox-triage | Confirm a triage report covers every rubric bucket and uses thread IDs rather than bodies |
| `validate_pubmed_esummary.py` | pubmed-digest | Confirm a PubMed ESummary JSON payload has the expected per-record fields |
| `validate_semantic_scholar.py` | paper-summary | Confirm a Semantic Scholar paper-details JSON has required fields; surfaces missing recommended fields as warnings |
| `validate_wiki_frontmatter.py` | any skill writing to `vault/wiki/<domain>/` | Confirm a vault wiki page's frontmatter carries domain/source/created/updated/tags in the right shape |

## Call pattern from a skill

A skill invokes the validator as a Bash tool call:

```bash
python3 scripts/validators/validate_arxiv_atom.py < /tmp/arxiv-today.xml
```

Skills should handle exit codes:

- 0 — proceed.
- 1 — validation failed; the JSON `errors` field lists what.
- 2 — script bug or bad input shape; treat as fatal, report to user.

## Why centralized

Same reason as `references/services/`: a parser change lands in one
place. See `standards/skill-authoring.md` §9.
