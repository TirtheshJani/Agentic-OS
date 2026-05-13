#!/usr/bin/env python3
"""Validate a Semantic Scholar Graph API paper-details JSON payload.

Reads JSON from stdin (a single paper object as returned by
GET /paper/{id}?fields=... or one element of a batch response).

Asserts the response shape and warns on common missing-field cases
that a summarization skill needs to handle gracefully (null abstract,
null tldr, missing externalIds).

Exit 0 = ok, 1 = validation failed, 2 = bad input / parse error.
Writes a JSON object to stdout:
  {ok, paper_id, warnings[], errors[]}
"""
import json
import sys

REQUIRED_FIELDS = ("paperId", "title")
RECOMMENDED_FIELDS = (
    "abstract",
    "authors",
    "year",
    "venue",
    "externalIds",
    "tldr",
    "openAccessPdf",
    "citationCount",
)


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print(
            json.dumps(
                {
                    "ok": False,
                    "paper_id": None,
                    "warnings": [],
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
                    "paper_id": None,
                    "warnings": [],
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
                    "paper_id": None,
                    "warnings": [],
                    "errors": ["root is not an object"],
                }
            )
        )
        return 1

    errors: list[str] = []
    for field in REQUIRED_FIELDS:
        if field not in data or data[field] in (None, ""):
            errors.append(f"missing required field: {field}")

    paper_id = data.get("paperId")

    if errors:
        print(
            json.dumps(
                {
                    "ok": False,
                    "paper_id": paper_id,
                    "warnings": [],
                    "errors": errors,
                },
                ensure_ascii=False,
            )
        )
        return 1

    warnings: list[str] = []
    for field in RECOMMENDED_FIELDS:
        if field not in data:
            warnings.append(f"field absent from response: {field}")
        elif data[field] is None:
            warnings.append(f"field is null: {field}")

    authors = data.get("authors")
    if authors is not None and not isinstance(authors, list):
        errors.append("authors is present but not a list")

    external_ids = data.get("externalIds")
    if external_ids is not None and not isinstance(external_ids, dict):
        errors.append("externalIds is present but not an object")

    open_access = data.get("openAccessPdf")
    if isinstance(open_access, dict):
        url = open_access.get("url")
        if url is not None and not isinstance(url, str):
            errors.append("openAccessPdf.url is present but not a string")

    ok = not errors
    print(
        json.dumps(
            {
                "ok": ok,
                "paper_id": paper_id,
                "warnings": warnings,
                "errors": errors,
            },
            ensure_ascii=False,
        )
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
