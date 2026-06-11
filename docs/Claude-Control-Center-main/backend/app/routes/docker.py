from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import docker_service

bp = Blueprint("docker", __name__, url_prefix="/api/docker")


@bp.get("/stacks")
def list_stacks():
    return jsonify(docker_service.list_stacks())


@bp.get("/stacks/<name>/detail")
def stack_detail(name: str):
    return jsonify(docker_service.get_stack_detail(name))


@bp.post("/stacks/<name>/start")
def start_stack(name: str):
    return jsonify(docker_service.stack_action(name, "start"))


@bp.post("/stacks/<name>/stop")
def stop_stack(name: str):
    return jsonify(docker_service.stack_action(name, "stop"))


@bp.post("/stacks/<name>/restart")
def restart_stack(name: str):
    return jsonify(docker_service.stack_action(name, "restart"))


@bp.post("/stacks/<name>/redeploy")
def redeploy_stack(name: str):
    return jsonify(docker_service.redeploy_stack(name))


@bp.get("/stacks/<name>/logs")
def stack_logs(name: str):
    lines = request.args.get("lines", 200, type=int)
    return jsonify(docker_service.get_logs(name, lines))
