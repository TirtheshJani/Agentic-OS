"""Pydantic v2 request body validation decorator.

Usage:
    from pydantic import BaseModel
    from app.core.validation import validate_body

    class CreateThing(BaseModel):
        name: str
        count: int = 1

    @bp.post("/things")
    @validate_body(CreateThing)
    def create_thing(body: CreateThing):
        ...

Pydantic is an optional runtime dependency. Import this module lazily from
routes that need it; if pydantic isn't installed, ``validate_body`` raises
``ImportError`` at decoration time with a clear message.
"""
from __future__ import annotations

from functools import wraps
from typing import Any, Callable, TypeVar

from flask import request

from app.core.responses import ApiError

try:
    from pydantic import BaseModel, ValidationError  # type: ignore
    _HAS_PYDANTIC = True
except ImportError:  # pragma: no cover
    BaseModel = object  # type: ignore[assignment,misc]
    ValidationError = Exception  # type: ignore[assignment,misc]
    _HAS_PYDANTIC = False

M = TypeVar("M", bound="BaseModel")


def validate_body(model: type[M]) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    if not _HAS_PYDANTIC:
        raise ImportError(
            "validate_body requires pydantic>=2. Install it via requirements-dev.txt."
        )

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            raw = request.get_json(silent=True)
            if raw is None:
                raise ApiError(
                    "Request body must be valid JSON",
                    status=400,
                    code="invalid_json",
                )
            try:
                parsed = model.model_validate(raw)
            except ValidationError as exc:
                raise ApiError(
                    "Request body failed validation",
                    status=422,
                    code="validation_error",
                    details=exc.errors(),
                ) from exc
            return fn(*args, body=parsed, **kwargs)

        return wrapper

    return decorator
