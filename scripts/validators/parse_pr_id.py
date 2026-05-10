#!/usr/bin/env python3
"""Parse a PR identifier from stdin into JSON {owner, repo, num}.

Accepted forms (read from stdin, one per invocation):
  - https://github.com/<owner>/<repo>/pull/<num>
  - http://github.com/<owner>/<repo>/pull/<num>
  - <owner>/<repo>#<num>
  - #<num>     (requires DEFAULT_REPO env var like "owner/repo")
  - <num>      (same)

Exit codes:
  0  parsed; JSON written to stdout
  1  unrecognized identifier; message on stderr
  2  bad usage
"""

from __future__ import annotations

import json
import os
import re
import sys

URL_RE = re.compile(
    r"^https?://github\.com/([\w.-]+)/([\w.-]+)/pull/(\d+)/?$"
)
SHORT_RE = re.compile(r"^([\w.-]+)/([\w.-]+)#(\d+)$")
NUM_ONLY_RE = re.compile(r"^#?(\d+)$")


def parse(s: str) -> dict:
    s = s.strip()
    if not s:
        raise ValueError("empty input")
    m = URL_RE.match(s)
    if m:
        return {"owner": m.group(1), "repo": m.group(2), "num": int(m.group(3))}
    m = SHORT_RE.match(s)
    if m:
        return {"owner": m.group(1), "repo": m.group(2), "num": int(m.group(3))}
    m = NUM_ONLY_RE.match(s)
    if m:
        default = os.environ.get("DEFAULT_REPO")
        if not default or "/" not in default:
            raise ValueError(
                f"bare PR number {s!r} requires DEFAULT_REPO=owner/repo"
            )
        owner, repo = default.split("/", 1)
        return {"owner": owner, "repo": repo, "num": int(m.group(1))}
    raise ValueError(f"unrecognized PR identifier: {s!r}")


def main() -> int:
    if len(sys.argv) > 1:
        print("usage: parse_pr_id.py < input", file=sys.stderr)
        return 2
    raw = sys.stdin.read()
    try:
        result = parse(raw)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
