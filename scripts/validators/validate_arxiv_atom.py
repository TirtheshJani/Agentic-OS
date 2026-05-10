#!/usr/bin/env python3
"""Validate that an arXiv Atom response has the shape skills expect.

Reads XML from a file path argument or stdin. Reports as JSON:
{
  "ok": bool,
  "entry_count": int,
  "errors": [str, ...]
}

Checks:
  - Document parses as XML.
  - Root element is atom:feed.
  - At least one atom:entry.
  - Each entry has atom:id, atom:title, atom:summary, atom:published.
  - Each entry has arxiv:primary_category.

Exit codes:
  0  shape valid
  1  shape invalid (errors in JSON output)
  2  bad usage / file not readable
"""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}
REQUIRED_ENTRY_FIELDS = ["id", "title", "summary", "published"]


def validate(xml_text: str) -> dict:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        return {"ok": False, "entry_count": 0, "errors": [f"xml parse error: {e}"]}

    errors: list[str] = []

    # Root element check (handles either prefixed or default namespace).
    if not (root.tag.endswith("}feed") or root.tag == "feed"):
        errors.append(f"root element is {root.tag!r}, expected atom:feed")

    entries = root.findall("atom:entry", NS)
    if not entries:
        errors.append("no atom:entry elements found")

    for i, entry in enumerate(entries):
        for field in REQUIRED_ENTRY_FIELDS:
            if entry.find(f"atom:{field}", NS) is None:
                errors.append(f"entry[{i}] missing atom:{field}")
        if entry.find("arxiv:primary_category", NS) is None:
            errors.append(f"entry[{i}] missing arxiv:primary_category")

    return {"ok": not errors, "entry_count": len(entries), "errors": errors}


def main() -> int:
    if len(sys.argv) > 2:
        print("usage: validate_arxiv_atom.py [path]", file=sys.stderr)
        return 2
    if len(sys.argv) == 2:
        try:
            text = Path(sys.argv[1]).read_text()
        except OSError as e:
            print(f"cannot read {sys.argv[1]}: {e}", file=sys.stderr)
            return 2
    else:
        text = sys.stdin.read()
    result = validate(text)
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
