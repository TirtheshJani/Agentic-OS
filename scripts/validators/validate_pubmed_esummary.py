#!/usr/bin/env python3
"""Validate a PubMed ESummary JSON payload from stdin.

Asserts the response is a well-formed ESummary result with the expected
top-level shape and that each record has the minimum fields a digest
skill consumes.

Exit 0 = ok, 1 = validation failed, 2 = bad input / parse error.
Writes a JSON object to stdout:
  {ok, count, missing_fields[], malformed_records[], errors[]}
"""
import json
import sys

REQUIRED_FIELDS = ("title", "pubdate", "authors", "source", "pubtype")


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print(
            json.dumps(
                {
                    "ok": False,
                    "count": 0,
                    "missing_fields": [],
                    "malformed_records": [],
                    "errors": ["empty input"],
                }
            )
        )
        return 2
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "count": 0,
                    "missing_fields": [],
                    "malformed_records": [],
                    "errors": [f"JSON parse: {e}"],
                }
            )
        )
        return 2

    if not isinstance(data, dict):
        print(
            json.dumps(
                {
                    "ok": False,
                    "count": 0,
                    "missing_fields": [],
                    "malformed_records": [],
                    "errors": ["root is not an object"],
                }
            )
        )
        return 1

    result = data.get("result")
    if not isinstance(result, dict):
        print(
            json.dumps(
                {
                    "ok": False,
                    "count": 0,
                    "missing_fields": [],
                    "malformed_records": [],
                    "errors": ["missing or non-object 'result' key"],
                }
            )
        )
        return 1

    uids = result.get("uids")
    if not isinstance(uids, list):
        print(
            json.dumps(
                {
                    "ok": False,
                    "count": 0,
                    "missing_fields": [],
                    "malformed_records": [],
                    "errors": ["missing or non-list 'result.uids'"],
                }
            )
        )
        return 1

    missing_fields: list[str] = []
    malformed: list[str] = []
    for uid in uids:
        if not isinstance(uid, str):
            malformed.append(f"non-string uid: {uid!r}")
            continue
        rec = result.get(uid)
        if not isinstance(rec, dict):
            malformed.append(f"uid={uid} missing or non-object record")
            continue
        for field in REQUIRED_FIELDS:
            if field not in rec:
                missing_fields.append(f"uid={uid} missing {field}")
        authors = rec.get("authors")
        if authors is not None and not isinstance(authors, list):
            malformed.append(f"uid={uid} authors is not a list")
        pubtype = rec.get("pubtype")
        if pubtype is not None and not isinstance(pubtype, list):
            malformed.append(f"uid={uid} pubtype is not a list")

    ok = not missing_fields and not malformed
    print(
        json.dumps(
            {
                "ok": ok,
                "count": len(uids),
                "missing_fields": missing_fields,
                "malformed_records": malformed,
                "errors": [],
            },
            ensure_ascii=False,
        )
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
