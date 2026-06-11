"""Uniform JSON response helpers and error handling.

Routes that opt into these helpers gain a consistent envelope:
    success -> 200 with the payload directly (no envelope wrap)
    failure -> {"error": {"code": str, "message": str, "details": ...}}

Routes raise ``ApiError`` to signal expected failures; the registered handler
maps it to a JSON response. Unhandled exceptions get a 500 with a generic
message (the traceback is logged, never serialised to the client).
"""
from __future__ import annotations

import logging
from typing import Any

from flask import Flask, jsonify

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """Raise from a route to return a structured JSON error."""

    def __init__(
        self,
        message: str,
        *,
        status: int = 400,
        code: str = "bad_request",
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details


def ok(payload: Any = None, *, status: int = 200):
    if payload is None:
        return ("", 204)
    return jsonify(payload), status


def err(message: str, *, status: int = 400, code: str = "bad_request", details: Any = None):
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return jsonify(body), status


def register_error_handlers(app: Flask) -> None:
    """Wire ApiError + generic 500 handlers onto a Flask app."""

    @app.errorhandler(ApiError)
    def _handle_api_error(exc: ApiError):
        return err(exc.message, status=exc.status, code=exc.code, details=exc.details)

    @app.errorhandler(500)
    def _handle_500(exc):
        logger.exception("Unhandled server error: %s", exc)
        return err("Internal server error", status=500, code="internal_error")
