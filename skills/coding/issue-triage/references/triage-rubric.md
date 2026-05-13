# Issue triage rubric

Used by the `issue-triage` skill.

## Buckets

Apply rows top-to-bottom; first match wins. Every open issue must land in
exactly one bucket.

| Bucket | Criteria | Suggested action (proposal only) |
|---|---|---|
| **Blocker** | Tagged `bug` + affects main branch or release + has a reproduction, OR explicitly blocks another issue/PR | Propose label `priority:high`; surface in response top |
| **Reply-now** | Author is waiting on a maintainer answer (open question, no comment from owner in >3 days, age <30 days) | Draft a comment in the report; do not post |
| **Needs-info** | Missing reproduction, version, OS, or expected-vs-actual; author last activity <14 days | Propose `needs-info` label + draft a short request comment |
| **Watch** | Active discussion (≥3 commenters in last 14 days) but no clear next action | No action; track in report under Watch |
| **Stale-candidate** | No author activity for ≥60 days AND not labelled `pinned`, `keep-open`, or `roadmap` | Propose `stale` label; draft a one-line "still relevant?" ping |
| **Wontfix-candidate** | Duplicate of a closed issue, OR explicitly out of scope per `CONTRIBUTING.md` / repo description, OR superseded by a merged PR | Propose `wontfix` or `duplicate` label; draft a close note |

## Duplicate detection

Two issues are duplicates when **both** are true:
- Title cosine-similarity (case-insensitive, after stripping `[bug]`,
  `feat:`, etc.) above ~0.7, AND
- Bodies reference the same error string, file path, or feature name.

When in doubt, mark as Watch and note "possible duplicate of #N" in the
report rather than calling it. Humans do the final dedup.

## Drafting rules (Reply-now, Needs-info, Stale-candidate, Wontfix-candidate)

- Drafts are written into the report under each issue's entry. **Never
  posted as comments.**
- Open with the ask in one line ("You're asking whether X — short
  answer:").
- For Needs-info: list the exact missing fields as a checkbox list.
- For Stale-candidate: one sentence, polite, with a 14-day soft deadline
  ("If we don't hear back in two weeks, this will be closed as stale.").
- For Wontfix-candidate: cite the duplicate issue number or the section
  of `CONTRIBUTING.md` / repo scope that excludes it.
- If unsure, draft a clarifying question instead of a guess.

## Escalation

- Anything tagged `security` or containing "vulnerability", "CVE",
  "exploit", "credentials leaked" → surface in response **and** in an
  Escalations section. Do not draft a public reply; security issues need
  a private channel.
- Anything from a sponsor / named-VIP author → bump to Reply-now
  regardless of bucket.
- Issues opened by the repo owner themselves usually belong in Watch (the
  owner is tracking their own work) — do not draft replies to them.

## Safety rule

The skill **never auto-comments, never auto-labels, never auto-closes**.
All labels, comments, and close actions are proposals in the report. The
human applies them.
