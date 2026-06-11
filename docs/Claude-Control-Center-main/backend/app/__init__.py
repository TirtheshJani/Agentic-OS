import os

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from app.config import CORS_ORIGIN, PORT
from app.routes import register_blueprints
from app.services import start_background_services

_ALLOWED_HOSTS = {
    "localhost",
    "127.0.0.1",
    f"localhost:{PORT}",
    f"127.0.0.1:{PORT}",
}
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    dist_dir = os.path.join(os.path.dirname(__file__), "../../frontend/dist")

    CORS(app, origins=[CORS_ORIGIN], supports_credentials=True)

    @app.before_request
    def security_checks():
        # DNS rebinding defense: reject requests with unexpected Host header
        host = request.host.lower()
        host_name = host.split(":")[0]
        if host not in _ALLOWED_HOSTS and host_name not in {"localhost", "127.0.0.1"}:
            return jsonify({"error": "Forbidden"}), 403
        # CSRF defense: require custom header on all state-changing requests
        if request.method not in _SAFE_METHODS:
            if request.headers.get("X-Requested-With") != "XMLHttpRequest":
                return jsonify({"error": "Forbidden"}), 403

    @app.after_request
    def set_security_headers(response):
        # Skip for SSE streams — adding headers would break chunked transfer
        if "text/event-stream" in response.content_type:
            return response
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "font-src 'self' data:;"
        )
        return response

    register_blueprints(app)
    start_background_services()

    # Serve frontend for non-API routes
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        if path and os.path.exists(os.path.join(dist_dir, path)):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, "index.html")

    return app
