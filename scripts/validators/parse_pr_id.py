#!/usr/bin/env python3
"""Parse a PR reference into {owner, repo, number}.

Accepts (in argv[1]):
  https://github.com/o/r/pull/123       -> owner=o, repo=r, number=123
  o/r#123                                -> owner=o, repo=r, number=123
  #123                                   -> falls back to GH_OWNER + GH_REPO env vars

Exit 0 on success, 1 if shape is unparseable, 2 on usage error.
Writes JSON to stdout: {ok, owner, repo, number, errors[]}.
"""
import json
import os
import re
import sys

URL_RE = re.compile(
    r"^https?://github\.com/(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+)/pull/(?P<number>\d+)/?$"
)
SHORTHAND_RE = re.compile(
    r"^(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+)#(?P<number>\d+)$"
)
BARE_RE = re.compile(r"^#(?P<number>\d+)$")


def fail(reason: str, exit_code: int = 1) -> int:
    print(
        json.dumps(
            {
                "ok": False,
                "owner": None,
                "repo": None,
                "number": None,
                "errors": [reason],
            }
        )
    )
    return exit_code


def ok(owner: str, repo: str, number: int) -> int:
    print(
        json.dumps(
            {
                "ok": True,
                "owner": owner,
                "repo": repo,
                "number": number,
                "errors": [],
            }
        )
    )
    return 0


def main() -> int:
    if len(sys.argv) != 2:
        return fail("usage: parse_pr_id.py <ref>", exit_code=2)
    ref = sys.argv[1].strip()

    m = URL_RE.match(ref)
    if m:
        return ok(m["owner"], m["repo"], int(m["number"]))

    m = SHORTHAND_RE.match(ref)
    if m:
        return ok(m["owner"], m["repo"], int(m["number"]))

    m = BARE_RE.match(ref)
    if m:
        owner = os.environ.get("GH_OWNER")
        repo = os.environ.get("GH_REPO")
        if not owner or not repo:
            return fail(
                "bare #N requires GH_OWNER and GH_REPO env vars"
            )
        return ok(owner, repo, int(m["number"]))

    return fail(f"unrecognized PR reference: {ref!r}")


if __name__ == "__main__":
    sys.exit(main())
