from __future__ import annotations

import re

_CHECKBOX_RE = re.compile(r"^- \[([ x])\] (.+)$", re.MULTILINE | re.IGNORECASE)


def parse_steps(markdown: str) -> list[dict]:
    """Parse GFM checkboxes from markdown.

    Returns a list of dicts: [{id, line, text, checked}, ...]
    where id is a zero-based integer index and line is the 1-based line number
    of the checkbox in the source text.
    """
    results: list[dict] = []
    lines = markdown.splitlines()
    step_id = 0
    for lineno, line in enumerate(lines, start=1):
        m = _CHECKBOX_RE.match(line)
        if m:
            checked_char, text = m.group(1), m.group(2).strip()
            results.append({
                "id": step_id,
                "line": lineno,
                "text": text,
                "checked": checked_char.lower() == "x",
            })
            step_id += 1
    return results
