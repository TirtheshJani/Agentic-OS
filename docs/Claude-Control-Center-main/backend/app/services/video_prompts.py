from __future__ import annotations

"""Prompt templates for the video research pipeline phases.

Each prompt instructs `claude -p` to call the appropriate skill and write
deliverables directly into a given per-job directory using the Write tool.
Keeping prompts here keeps the service file focused on subprocess orchestration.
"""

from pathlib import Path


_FORMAT_GUIDE_LONG = """\
FORMAT: Long-form YouTube video (10-20 minutes).
- Conversational, educational tone.
- Include an intro hook (~15-30s), 3-6 chaptered sections, and a wrap-up with a call-to-action.
- Storyboard should include b-roll suggestions, on-screen text, simple diagrams, and transitions per beat.
"""

_FORMAT_GUIDE_SHORT = """\
FORMAT: Short-form YouTube Short (< 60 seconds, vertical 9:16).
- Punchy, single-concept, fast pacing.
- Strong 1-2 second hook, single payoff, abrupt CTA at the end.
- Storyboard should be beat-by-beat with second-precise timestamps, on-screen text, and cut directions.
"""


def _format_guide(video_format: str) -> str:
    return _FORMAT_GUIDE_SHORT if video_format == "short" else _FORMAT_GUIDE_LONG


def research_prompt(topic: str, out_dir: Path, vault_id: str | None) -> str:
    """Phase 1: run vault-research-pipeline and capture a research_summary.md in out_dir."""
    vault_hint = (
        f"The user's Obsidian vault is registered (vault_id={vault_id}); "
        "the vault-research-pipeline skill will dedup against it automatically.\n"
        if vault_id
        else "If no Obsidian vault is registered, skip vault dedup and proceed.\n"
    )
    return (
        f"Use the vault-research-pipeline skill to research this topic deeply: \"{topic}\".\n\n"
        f"{vault_hint}"
        "After the skill completes, write a single consolidated research summary to this exact path "
        f"using the Write tool: {out_dir}/research_summary.md\n\n"
        "The research_summary.md MUST include:\n"
        "1. A YAML frontmatter block with `topic`, `created`, and `sources_count`.\n"
        "2. A one-paragraph executive summary.\n"
        "3. Key facts and insights as bullet points (group by sub-theme).\n"
        "4. A `## Sources` section listing every YouTube video, article, or vault note used "
        "(title + URL or vault path).\n"
        "5. A `## Open Questions` section: anything the research left unanswered.\n\n"
        "Do not write any other files in that directory. Do not ask follow-up questions; "
        "make reasonable choices and proceed."
    )


def angles_prompt(topic: str, research_path: Path, out_dir: Path, n: int = 5) -> str:
    """Phase 2 (topic-exploration only): propose N video angles as JSON."""
    return (
        f"Read the research summary at {research_path}. Based on it, propose exactly {n} distinct "
        f"YouTube video angles for the broad topic \"{topic}\". Each angle should be a different "
        "framing, audience cut, or sub-question — not the same idea reworded.\n\n"
        f"Write the result to {out_dir}/angles.json using the Write tool. The file must be valid JSON "
        "with this exact shape:\n\n"
        "{\n"
        '  "angles": [\n'
        '    {\n'
        '      "title": "<catchy working title>",\n'
        '      "hook": "<1-sentence hook>",\n'
        '      "audience": "<who this is for>",\n'
        '      "key_points": ["<point 1>", "<point 2>", "<point 3>"],\n'
        '      "format_hint": "long" | "short"\n'
        '    }\n'
        "  ]\n"
        "}\n\n"
        "Output ONLY the JSON file. Do not write anything else. Do not ask follow-up questions."
    )


def synthesis_prompt(
    topic: str,
    angle: dict | None,
    video_format: str,
    research_path: Path,
    out_dir: Path,
) -> str:
    """Phase 3: produce all video deliverables from the research."""
    angle_block = ""
    if angle:
        key_points = "\n".join(f"  - {p}" for p in angle.get("key_points", []))
        angle_block = (
            f"\nThe user picked this specific angle to script:\n"
            f"- Title: {angle.get('title', '')}\n"
            f"- Hook: {angle.get('hook', '')}\n"
            f"- Audience: {angle.get('audience', '')}\n"
            f"- Key points:\n{key_points}\n\n"
            "Focus the script tightly on this angle; ignore unrelated material from the research.\n"
        )

    return (
        f"Read the research summary at {research_path}.\n\n"
        f"Produce all deliverables for a YouTube video on \"{topic}\".\n"
        f"{angle_block}\n"
        f"{_format_guide(video_format)}\n"
        f"Write EXACTLY these five files into {out_dir}, using the Write tool:\n\n"
        "1. `script.md` — the full word-for-word transcript the creator will read on camera. "
        "Plain prose, no markdown headers inside spoken paragraphs. Include section labels "
        "as `### [INTRO]`, `### [SECTION: ...]`, `### [OUTRO]` between spoken blocks (long-form) "
        "or `### [00:00-00:05]` second-range labels (short-form). At the top, include YAML "
        "frontmatter with `title`, `format`, `target_duration_seconds`, `word_count_estimate`.\n\n"
        "2. `storyboard.md` — shot-by-shot table. Columns: Beat | Visual | On-screen text | "
        "B-roll / cut notes | Spoken cue (first words of the matching script line). One row per beat.\n\n"
        "3. `titles.json` — exactly this JSON shape:\n"
        "{\n"
        '  \"titles\": [{\"title\": \"...\", \"rationale\": \"...\"}, ...5 items],\n'
        '  \"thumbnail_concepts\": [{\"concept\": \"...\", \"composition\": \"...\", \"text_overlay\": \"...\"}, ...3 items]\n'
        "}\n\n"
        "4. `thumbnail_concepts.md` — human-readable expansion of the 3 thumbnail concepts with "
        "specific visual direction (subject, framing, color palette, expression, text style).\n\n"
        "5. `show_notes.md` — the YouTube video description. Include: opening paragraph, "
        "chapter markers with timestamps (long-form) or hashtags (short-form), a `Sources` list "
        "copied from the research summary, and `Tags:` line.\n\n"
        "Do not write any other files. Do not ask follow-up questions; make reasonable choices."
    )
