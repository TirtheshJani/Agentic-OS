from flask import Flask

from app.core.responses import ApiError, err, ok, register_error_handlers


def _app() -> Flask:
    app = Flask(__name__)
    register_error_handlers(app)
    return app


def test_ok_returns_json():
    app = _app()
    with app.test_request_context():
        resp, status = ok({"a": 1})
        assert status == 200
        assert resp.get_json() == {"a": 1}


def test_ok_none_returns_204():
    app = _app()
    with app.test_request_context():
        body, status = ok(None)
        assert status == 204
        assert body == ""


def test_err_envelope():
    app = _app()
    with app.test_request_context():
        resp, status = err("nope", status=418, code="teapot", details={"hint": "tea"})
        assert status == 418
        assert resp.get_json() == {
            "error": {"code": "teapot", "message": "nope", "details": {"hint": "tea"}}
        }


def test_api_error_handler():
    app = _app()

    @app.get("/raise")
    def _raise():
        raise ApiError("bad thing", status=422, code="bad")

    client = app.test_client()
    resp = client.get("/raise")
    assert resp.status_code == 422
    assert resp.get_json() == {"error": {"code": "bad", "message": "bad thing"}}
