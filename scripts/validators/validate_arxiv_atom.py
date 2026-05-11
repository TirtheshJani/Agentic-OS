#!/usr/bin/env python3
"""Validate an arXiv Atom payload from stdin.

Exit 0 = ok, 1 = validation failed, 2 = bad input / parse error.
Writes a JSON object to stdout: {ok, count, errors[]}.
"""
import json
import sys
import xml.etree.ElementTree as ET

ATOM = "http://www.w3.org/2005/Atom"
ARXIV = "http://arxiv.org/schemas/atom"
NS = {"a": ATOM, "x": ARXIV}


def main() -> int:
    raw = sys.stdin.buffer.read()
    if not raw.strip():
        print(json.dumps({"ok": False, "count": 0, "errors": ["empty input"]}))
        return 2
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(
            json.dumps(
                {"ok": False, "count": 0, "errors": [f"XML parse: {e}"]}
            )
        )
        return 2

    tag = root.tag
    if not tag.endswith("}feed"):
        print(
            json.dumps(
                {
                    "ok": False,
                    "count": 0,
                    "errors": [f"root is {tag!r}, expected Atom feed"],
                }
            )
        )
        return 1

    errors: list[str] = []
    entries = root.findall("a:entry", NS)
    for idx, entry in enumerate(entries):
        for child in ("id", "title", "summary", "published"):
            if entry.find(f"a:{child}", NS) is None:
                errors.append(f"entry[{idx}] missing <{child}>")
        if not entry.findall("a:author", NS):
            errors.append(f"entry[{idx}] missing <author>")
        id_el = entry.find("a:id", NS)
        if id_el is not None and id_el.text:
            if "arxiv.org/abs/" not in id_el.text:
                errors.append(
                    f"entry[{idx}] id does not look like arxiv URL: "
                    f"{id_el.text!r}"
                )

    ok = not errors
    print(
        json.dumps(
            {"ok": ok, "count": len(entries), "errors": errors},
            ensure_ascii=False,
        )
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
