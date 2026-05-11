#!/usr/bin/env python3
"""Validate an inbox-triage report.

Asserts every required rubric bucket is present in the report and
that the report references threads by ID rather than body content.

Reads markdown from stdin. Exit 0 = ok, 1 = missing/violating, 2 = bad input.
Writes JSON: {ok, missing_buckets[], suspicious_body_lines[], errors[]}.
"""
import json
import re
import sys

REQUIRED_BUCKETS = [
    "Reply now",
    "Reply later",
    "Read & file",
    "Archive",
    "Spam/Promo",
]
THREAD_ID_RE = re.compile(r"thread[:/]([0-9a-fA-F]{8,})", re.IGNORECASE)
QUOTE_BLOCK_RE = re.compile(r"^\s*>\s")
BODY_LIKE_RE = re.compile(
    r"^\s*(?:Hi|Hello|Dear|Hey)\b.{20,}", re.MULTILINE
)


def main() -> int:
    body = sys.stdin.read()
    if not body.strip():
        print(
            json.dumps(
                {
                    "ok": False,
                    "missing_buckets": REQUIRED_BUCKETS,
                    "suspicious_body_lines": [],
                    "errors": ["empty input"],
                }
            )
        )
        return 2

    missing = [b for b in REQUIRED_BUCKETS if b not in body]

    suspicious: list[str] = []
    for i, line in enumerate(body.splitlines(), start=1):
        if QUOTE_BLOCK_RE.match(line):
            suspicious.append(f"line {i}: blockquote (possible body paste)")
    for m in BODY_LIKE_RE.finditer(body):
        line_no = body[: m.start()].count("\n") + 1
        suspicious.append(f"line {line_no}: greeting-style prose")

    has_ids = bool(THREAD_ID_RE.search(body))
    errors: list[str] = []
    if not has_ids:
        errors.append(
            "report does not reference any thread IDs "
            "(rubric requires thread:<id> citations)"
        )

    ok = not missing and not suspicious and not errors
    print(
        json.dumps(
            {
                "ok": ok,
                "missing_buckets": missing,
                "suspicious_body_lines": suspicious,
                "errors": errors,
            },
            ensure_ascii=False,
        )
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
