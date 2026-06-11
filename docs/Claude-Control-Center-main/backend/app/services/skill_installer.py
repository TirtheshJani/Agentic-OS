from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from app.config import CLAUDE_DIR


def _skill_dir(slug: str) -> Path:
    return CLAUDE_DIR / "skills" / slug


def _subagent_path(slug: str) -> Path:
    return CLAUDE_DIR / "agents" / f"{slug}.md"


def _memory_path(slug: str) -> Path:
    return CLAUDE_DIR / "agent_memory" / f"{slug}.md"


def generate_skill_md(agent: dict[str, Any]) -> str:
    slug = agent["slug"]
    name = agent["name"]
    description = agent["description"]
    system_prompt = agent.get("system_prompt", "")
    capabilities = set(agent.get("capabilities", []))
    cli_tools = agent.get("cli_tools", [])

    lines = [
        "---",
        f"name: {slug}",
        f"description: {description}",
        "version: 1.0.0",
        "user-invocable: true",
        'argument-hint: "[task description]"',
        "---",
        "",
        f"# {name}",
        "",
    ]

    if system_prompt:
        lines += [system_prompt, ""]

    if "web_search" in capabilities:
        lines += [
            "## Web Search & Scraping",
            "",
            "Use the WebSearch tool to look up information online. Use WebFetch to retrieve full page content from specific URLs. Prefer authoritative sources. Summarize findings concisely.",
            "",
        ]

    if "code_exec" in capabilities:
        lines += [
            "## Code Execution",
            "",
            "Use the Bash tool to run shell commands, scripts, and programs. Verify output before proceeding. Handle errors explicitly.",
            "",
        ]

    if "cli" in capabilities and cli_tools:
        tool_list = ", ".join(f"`{t}`" for t in cli_tools)
        lines += [
            "## CLI Tools",
            "",
            f"You are proficient with these CLI tools: {tool_list}. Prefer using them over manual file edits when appropriate.",
            "",
        ]

    if "memory" in capabilities:
        memory_path = _memory_path(slug)
        lines += [
            "## Cross-Session Memory",
            "",
            f"At the start of each session, read `{memory_path}` if it exists to recall prior context.",
            f"At the end of each session, append a short summary of key decisions or findings to `{memory_path}`.",
            "",
        ]

    return "\n".join(lines)


def generate_subagent_md(agent: dict[str, Any]) -> str:
    slug = agent["slug"]
    name = agent["name"]
    description = agent["description"]
    system_prompt = agent.get("system_prompt", "")
    capabilities = set(agent.get("capabilities", []))
    cli_tools = agent.get("cli_tools", [])

    tools = ["Read", "Edit", "Write", "Glob", "Grep"]
    if "code_exec" in capabilities:
        tools.append("Bash")
    if "web_search" in capabilities:
        tools += ["WebSearch", "WebFetch"]

    tools_str = ", ".join(tools)

    lines = [
        "---",
        f"name: {slug}",
        f"description: {description}",
        f"tools: {tools_str}",
        "---",
        "",
        f"# {name}",
        "",
    ]

    if system_prompt:
        lines += [system_prompt, ""]

    if "web_search" in capabilities:
        lines += [
            "## Web Search & Scraping",
            "",
            "Use WebSearch to look up information. Use WebFetch to retrieve full page content. Summarize findings concisely.",
            "",
        ]

    if "code_exec" in capabilities:
        lines += [
            "## Code Execution",
            "",
            "Use Bash to run commands and scripts. Verify output. Handle errors explicitly.",
            "",
        ]

    if "cli" in capabilities and cli_tools:
        tool_list = ", ".join(f"`{t}`" for t in cli_tools)
        lines += [
            "## CLI Tools",
            "",
            f"You are proficient with: {tool_list}.",
            "",
        ]

    if "memory" in capabilities:
        memory_path = _memory_path(slug)
        lines += [
            "## Cross-Session Memory",
            "",
            f"Read `{memory_path}` at session start for prior context. Append a short summary at session end.",
            "",
        ]

    return "\n".join(lines)


def install_skill(agent: dict[str, Any]) -> None:
    slug = agent["slug"]
    skill_dir = _skill_dir(slug)
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(generate_skill_md(agent), encoding="utf-8")


def install_subagent(agent: dict[str, Any]) -> None:
    slug = agent["slug"]
    subagent_file = _subagent_path(slug)
    subagent_file.parent.mkdir(parents=True, exist_ok=True)
    subagent_file.write_text(generate_subagent_md(agent), encoding="utf-8")


def install_memory(agent: dict[str, Any]) -> None:
    if "memory" not in agent.get("capabilities", []):
        return
    slug = agent["slug"]
    memory_file = _memory_path(slug)
    memory_file.parent.mkdir(parents=True, exist_ok=True)
    if not memory_file.exists():
        memory_file.write_text(
            f"# {agent['name']} — Cross-Session Memory\n\n"
            "_Append session summaries below. Each entry should include the date and key decisions._\n\n",
            encoding="utf-8",
        )


def uninstall_skill(slug: str) -> None:
    skill_dir = _skill_dir(slug)
    if skill_dir.exists():
        shutil.rmtree(skill_dir)


def uninstall_subagent(slug: str) -> None:
    subagent_file = _subagent_path(slug)
    if subagent_file.exists():
        subagent_file.unlink()


def read_memory(slug: str) -> str | None:
    path = _memory_path(slug)
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")
