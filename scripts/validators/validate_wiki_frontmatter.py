#!/usr/bin/env python3
"""Validate the YAML frontmatter on a vault wiki page.

Reads a markdown file from stdin. Asserts the page begins with a YAML
frontmatter block carrying the fields required by vault/CLAUDE.md:
  domain, source, created, updated, tags

The created/updated fields must look like ISO dates (YYYY-MM-DD).
The tags field must be a YAML list (flow or block style).

Exit 0 = ok, 1 = validation failed, 2 = bad input / parse error.
Writes a JSON object to stdout:
  {ok, missing_fields[], bad_fields[], errors[]}
"""
import json
import re
import sys

REQUIRED_FIELDS = ("domain", "source", "created", "updated", "tags")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_frontmatter(body: str) -> tuple[dict[str, str], list[str]]:
    """Minimal YAML mapping parser sufficient for vault frontmatter.

    Returns (fields, errors). Tags is returned as the literal raw value
    string for downstream shape checking; date fields are returned as-is.
    """
    errors: list[str] = []
    body = body.replace("\r\n", "\n")
    if not body.startswith("---\n"):
        errors.append("no opening frontmatter delimiter ('---' on line 1)")
        return {}, errors
    end = body.find("\n---", 4)
    if end < 0:
        errors.append("no closing frontmatter delimiter")
        return {}, errors
    block = body[4:end]
    fields: dict[str, str] = {}
    for raw_line in block.split("\n"):
        line = raw_line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line.startswith(" ") or line.startswith("\t"):
            continue
        if ":" not in line:
            errors.append(f"frontmatter line lacks ':': {line!r}")
            continue
        key, _, value = line.partition(":")
        fields[key.strip()] = value.strip()
    return fields, errors


def main() -> int:
    body = sys.stdin.read()
    if not body.strip():
        print(
            json.dumps(
                {
                    "ok": False,
                    "missing_fields": list(REQUIRED_FIELDS),
                    "bad_fields": [],
                    "errors": ["empty input"],
                }
            )
        )
        return 2

    fields, parse_errors = parse_frontmatter(body)
    if parse_errors and not fields:
        print(
            json.dumps(
                {
                    "ok": False,
                    "missing_fields": list(REQUIRED_FIELDS),
                    "bad_fields": [],
                    "errors": parse_errors,
                }
            )
        )
        return 1

    missing = [f for f in REQUIRED_FIELDS if f not in fields]
    bad: list[str] = []

    created = fields.get("created", "")
    if created and not DATE_RE.match(created):
        bad.append(f"created='{created}' is not YYYY-MM-DD")
    updated = fields.get("updated", "")
    if updated and not DATE_RE.match(updated):
        bad.append(f"updated='{updated}' is not YYYY-MM-DD")

    tags = fields.get("tags", "")
    if tags:
        is_flow = tags.startswith("[") and tags.endswith("]")
        is_block_marker = tags == ""
        if not (is_flow or is_block_marker):
            bad.append(
                f"tags='{tags}' is not a YAML list (use [a, b] or block form)"
            )

    ok = not missing and not bad and not parse_errors
    print(
        json.dumps(
            {
                "ok": ok,
                "missing_fields": missing,
                "bad_fields": bad,
                "errors": parse_errors,
            },
            ensure_ascii=False,
        )
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
