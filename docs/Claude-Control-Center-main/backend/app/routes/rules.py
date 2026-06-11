from flask import Blueprint, jsonify, request

from app.services.settings_io import read_global, write_global

bp = Blueprint("rules", __name__, url_prefix="/api/rules")

_LIST_TYPES = ("allow", "deny")


@bp.get("")
def get_rules():
    settings = read_global()
    permissions = settings.get("permissions", {})
    return jsonify({
        "allow": permissions.get("allow", []),
        "deny": permissions.get("deny", []),
    })


@bp.post("/<list_type>")
def add_rule(list_type: str):
    if list_type not in _LIST_TYPES:
        return jsonify({"error": "list_type must be 'allow' or 'deny'"}), 400
    body = request.get_json(silent=True) or {}
    pattern = (body.get("pattern") or "").strip()
    if not pattern:
        return jsonify({"error": "pattern required"}), 400

    settings = read_global()
    permissions = settings.setdefault("permissions", {})
    lst = permissions.setdefault(list_type, [])
    if pattern in lst:
        return jsonify({"error": "Rule already exists"}), 409
    lst.append(pattern)
    write_global(settings)
    return jsonify({"added": True, "pattern": pattern}), 201


@bp.delete("/<list_type>/<int:index>")
def delete_rule(list_type: str, index: int):
    if list_type not in _LIST_TYPES:
        return jsonify({"error": "list_type must be 'allow' or 'deny'"}), 400

    settings = read_global()
    permissions = settings.get("permissions", {})
    lst = permissions.get(list_type, [])
    if index >= len(lst):
        return jsonify({"error": "Index out of range"}), 404

    removed = lst.pop(index)
    settings.setdefault("permissions", {})[list_type] = lst
    write_global(settings)
    return jsonify({"deleted": True, "pattern": removed})
