# Contributing to Claude Control Center

Thank you for your interest in contributing. This document covers how to get set up, what conventions the project uses, and how to submit changes.

## Before you start

- For bug fixes and small improvements, you can open a pull request directly.
- For new features or significant changes to existing behaviour, please open an issue first to discuss the approach. This avoids wasted effort if the change doesn't align with the project's direction.

## Setup

Follow the [Development Guide](./docs/development.md) to get the backend and frontend running locally.

## Making changes

1. Fork the repository and create a feature branch from `main`.
2. Keep commits focused — one logical change per commit.
3. Confirm the frontend builds: `cd frontend && npm run build`
4. Confirm the backend starts without errors: `cd backend && python run.py`
5. Test your change manually in the browser.

## Pull request checklist

- [ ] Frontend builds without TypeScript errors
- [ ] Backend starts cleanly with no import errors
- [ ] New API endpoints are documented in [docs/api-reference.md](./docs/api-reference.md)
- [ ] New pages are added to the route table in [docs/architecture.md](./docs/architecture.md)
- [ ] No hardcoded paths — use `CLAUDE_DIR` / `CODEX_DIR` from `app.config`
- [ ] Mutating API calls include `X-Requested-With: XMLHttpRequest`
- [ ] No credentials, API keys, or personal data in the diff

## Code style

**Python** — no formatter is enforced, but follow PEP 8 and the patterns already in the codebase (thin route handlers, logic in services, orjson for serialisation).

**TypeScript / React** — named exports, TanStack Query for server state, `cn()` for conditional classes, CSS custom properties for colors.

See [docs/development.md](./docs/development.md) for full conventions.

## Reporting bugs

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS, Python version, Node version, and whether you are running in Docker or dev mode

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
