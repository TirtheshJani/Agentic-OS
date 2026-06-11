from __future__ import annotations

from importlib import import_module
from typing import Iterable

from flask import Blueprint, Flask

_BLUEPRINTS: tuple[tuple[str, str], ...] = (
    ("app.routes.projects", "bp"),
    ("app.routes.conversations", "bp"),
    ("app.routes.memory", "bp"),
    ("app.routes.memory_rag", "bp"),
    ("app.routes.plans", "bp"),
    ("app.routes.tasks", "bp"),
    ("app.routes.sessions", "bp"),
    ("app.routes.settings", "bp"),
    ("app.routes.plugins", "bp"),
    ("app.routes.commands", "bp"),
    ("app.routes.history", "bp"),
    ("app.routes.sse", "bp"),
    ("app.routes.codex", "bp"),
    ("app.routes.advisor", "bp"),
    ("app.routes.managed_agents", "bp"),
    ("app.routes.skills", "bp"),
    ("app.routes.analytics", "bp"),
    ("app.routes.semantic_layer", "bp"),
    ("app.routes.cache", "bp"),
    ("app.routes.changelog", "bp"),
    ("app.routes.routines", "bp"),
    ("app.routes.insights", "bp"),
    ("app.routes.codex_cli_sessions", "bp"),
    ("app.routes.codex_cli_skills", "bp"),
    ("app.routes.codex_cli_settings", "bp"),
    ("app.routes.codex_cli_memory", "bp"),
    ("app.routes.codex_cli_analytics", "bp"),
    ("app.routes.agent_library", "bp"),
    ("app.routes.mcp_servers", "bp"),
    ("app.routes.hooks", "bp"),
    ("app.routes.rules", "bp"),
    ("app.routes.claude_md", "bp"),
    ("app.routes.health", "bp"),
    ("app.routes.gws", "bp"),
    ("app.routes.mcp_bridge", "bp"),
    ("app.routes.gemini_sessions", "bp"),
    ("app.routes.gemini_skills", "bp"),
    ("app.routes.gemini_settings", "bp"),
    ("app.routes.gemini_analytics", "bp"),
    ("app.routes.gemini_memory", "bp"),
    ("app.routes.gemini_sse", "bp"),
    ("app.routes.obsidian", "bp"),
    ("app.routes.research", "bp"),
    ("app.routes.video_research", "bp"),
    ("app.routes.github", "bp"),
    ("app.routes.dashboard", "bp"),
    ("app.routes.docker", "bp"),
    ("app.routes.agent_view", "bp"),
    ("app.routes.git_tree", "bp"),
    ("app.routes.eval", "bp"),
    ("app.routes.goals", "bp"),
    ("app.routes.invoicing", "bp"),
    ("app.routes.crm", "bp"),
    ("app.routes.news", "bp"),
    ("app.routes.cli", "bp"),
    ("app.routes.search", "bp"),
    ("app.routes.bench", "bp"),
    ("app.routes.loops", "bp"),
    ("app.routes.scheduler", "bp"),
)


def iter_blueprints() -> Iterable[Blueprint]:
    for module_path, attr_name in _BLUEPRINTS:
        module = import_module(module_path)
        yield getattr(module, attr_name)


def register_blueprints(app: Flask) -> None:
    for blueprint in iter_blueprints():
        app.register_blueprint(blueprint)

    from app.routes import antigravity_sessions
    app.register_blueprint(antigravity_sessions.bp)

    from app.routes import antigravity_memory
    app.register_blueprint(antigravity_memory.bp)

    from app.routes import antigravity_skills
    app.register_blueprint(antigravity_skills.bp)

    from app.routes import antigravity_settings
    app.register_blueprint(antigravity_settings.bp)

