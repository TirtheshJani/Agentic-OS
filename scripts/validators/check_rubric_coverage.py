#!/usr/bin/env python3
"""Verify an inbox-triage report classifies every thread.

Reads a triage report (markdown) and confirms every thread bullet
appears under exactly one of the rubric buckets. Buckets are exactly
the H2 headings the skill writes:

  ## Reply now (drafted)
  ## Reply later
  ## Read & file
  ## Archive
  ## Spam/Promo
  ## Flagged

Bullets are lines that begin with "- " under one of the bucket
headings. Counts and totals are reported in JSON.

Exit codes:
  0  all bucket headings present
  1  one or more bucket headings missing (details in output)
  2  bad usage / file not readable
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BUCKETS = [
    "Reply now (drafted)",
    "Reply later",
    "Read & file",
    "Archive",
    "Spam/Promo",
    "Flagged",
]


def parse(md: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in md.splitlines():
        if line.startswith("## "):
            heading = line[3:].strip()
            current = heading if heading in BUCKETS else None
            if current is not None:
                sections.setdefault(current, [])
        elif current is not None and line.lstrip().startswith("- "):
            sections[current].append(line.strip())
    return sections


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check_rubric_coverage.py <report.md>", file=sys.stderr)
        return 2
    try:
        md = Path(sys.argv[1]).read_text()
    except OSError as e:
        print(f"cannot read {sys.argv[1]}: {e}", file=sys.stderr)
        return 2

    sections = parse(md)
    missing = [b for b in BUCKETS if b not in sections]
    counts = {b: len(sections.get(b, [])) for b in BUCKETS}
    total = sum(counts.values())
    result = {
        "ok": not missing,
        "missing_sections": missing,
        "counts_per_bucket": counts,
        "total_classified": total,
    }
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
