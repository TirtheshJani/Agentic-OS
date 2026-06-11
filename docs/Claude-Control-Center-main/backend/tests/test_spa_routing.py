"""
Tests for SPA (single-page application) deep-link routing.

Root cause: Flask's built-in static-file route (registered when static_url_path="/"
is set) uses the same /<path:filename> pattern as our serve_frontend catch-all.
Because Flask registers its own static route first, Werkzeug would route direct URL
requests (e.g. /sessions, /analytics) to Flask's static handler, which returns 404
for paths that don't correspond to real files on disk — never falling through to
serve_frontend.

Fix: set static_folder=None in the Flask constructor to disable Flask's built-in
static route, leaving serve_frontend as the sole handler for all non-API paths.
"""

import os
import pytest


# ---------------------------------------------------------------------------
# App factory with a real frontend/dist stub so file-existence checks work
# ---------------------------------------------------------------------------

@pytest.fixture
def app(tmp_path):
    """Return a configured Flask test client pointing at a minimal dist stub."""
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html><body>SPA</body></html>")
    (dist / "favicon.svg").write_text("<svg/>")
    assets = dist / "assets"
    assets.mkdir()
    (assets / "main.js").write_text("// bundle")

    # Patch dist_dir before importing create_app so the fixture doesn't rely on
    # the real frontend/dist being present in CI.
    import importlib
    import app as app_module

    original_create = app_module.create_app

    def patched_create():
        from flask import Flask, jsonify, request, send_from_directory
        from flask_cors import CORS
        from app.config import CORS_ORIGIN, PORT
        from app.routes import register_blueprints

        flask_app = Flask(__name__, static_folder=None)
        d = str(dist)

        CORS(flask_app, origins=[CORS_ORIGIN], supports_credentials=True)

        @flask_app.before_request
        def security_checks():
            host = request.host.lower()
            host_name = host.split(":")[0]
            _ALLOWED_HOSTS = {
                "localhost", "127.0.0.1",
                f"localhost:{PORT}", f"127.0.0.1:{PORT}",
            }
            if host not in _ALLOWED_HOSTS and host_name not in {"localhost", "127.0.0.1"}:
                return jsonify({"error": "Forbidden"}), 403
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                if request.headers.get("X-Requested-With") != "XMLHttpRequest":
                    return jsonify({"error": "Forbidden"}), 403

        register_blueprints(flask_app)

        @flask_app.route("/", defaults={"path": ""})
        @flask_app.route("/<path:path>")
        def serve_frontend(path: str):
            if path.startswith("api/"):
                return jsonify({"error": "Not found"}), 404
            if path and os.path.exists(os.path.join(d, path)):
                return send_from_directory(d, path)
            return send_from_directory(d, "index.html")

        return flask_app

    flask_app = patched_create()
    flask_app.config["TESTING"] = True
    yield flask_app.test_client()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSpaRouting:
    """Verify that the Flask backend serves index.html for all SPA routes."""

    # -- SPA deep-link routes should return 200 + index.html -----------------

    def test_root_returns_index(self, app):
        r = app.get("/")
        assert r.status_code == 200
        assert b"SPA" in r.data

    def test_sessions_page_returns_index(self, app):
        r = app.get("/sessions")
        assert r.status_code == 200, f"Expected 200, got {r.status_code} — deep-link broken"
        assert b"SPA" in r.data

    def test_analytics_page_returns_index(self, app):
        r = app.get("/analytics")
        assert r.status_code == 200, f"Expected 200, got {r.status_code} — deep-link broken"
        assert b"SPA" in r.data

    def test_settings_page_returns_index(self, app):
        r = app.get("/settings")
        assert r.status_code == 200
        assert b"SPA" in r.data

    def test_nested_route_returns_index(self, app):
        r = app.get("/sessions/some-session-id/messages")
        assert r.status_code == 200
        assert b"SPA" in r.data

    def test_memory_page_returns_index(self, app):
        r = app.get("/memory")
        assert r.status_code == 200
        assert b"SPA" in r.data

    def test_agents_page_returns_index(self, app):
        r = app.get("/agents")
        assert r.status_code == 200
        assert b"SPA" in r.data

    def test_unknown_route_returns_index(self, app):
        """Any unrecognised path must still return index.html (React Router handles 404)."""
        r = app.get("/definitely-not-a-real-page/123")
        assert r.status_code == 200
        assert b"SPA" in r.data

    # -- Static assets that DO exist should be served directly ----------------

    def test_favicon_served_directly(self, app):
        r = app.get("/favicon.svg")
        assert r.status_code == 200
        assert b"<svg" in r.data

    def test_js_asset_served_directly(self, app):
        r = app.get("/assets/main.js")
        assert r.status_code == 200
        assert b"bundle" in r.data

    # -- API routes must not be swallowed by the catch-all --------------------

    def test_api_prefix_not_served_as_spa(self, app):
        r = app.get("/api/sessions")
        # Real API routes return JSON; missing ones return our 404 JSON, not index.html
        assert r.status_code != 200 or b"SPA" not in r.data
