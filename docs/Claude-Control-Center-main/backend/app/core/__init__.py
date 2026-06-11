"""Foundation utilities shared across services and routes.

Phase 1 refactor: this package centralises atomic JSON I/O, JSONL parsing,
background scanner orchestration, response shaping, request validation, and
in-process pub/sub. Existing services have not yet been migrated; they may be
ported one-by-one in later PRs.
"""
