"""Cross-agent shared memory (RAG) + ingest control endpoints.

Backed by LightRAG via the proxy service. Project-scoped memory CRUD lives in
``memory.py``; this blueprint owns the non-project ``/api/memory`` surface.
"""
from flask import Blueprint, jsonify, request

from app.services import lightrag_proxy_service as rag_svc
from app.services import session_ingest_service as ingest_svc

bp = Blueprint("memory_rag", __name__, url_prefix="/api/memory")


@bp.get("/rag/status")
def rag_status():
    return jsonify(rag_svc.get_status())


@bp.post("/rag/search")
def rag_search():
    body = request.get_json(silent=True) or {}
    query_text = (body.get("query") or "").strip()
    if not query_text:
        return jsonify({"error": "query is required"}), 400
    mode = body.get("mode", "hybrid")
    top_k = int(body.get("top_k", 10))
    try:
        result = rag_svc.query(query_text, mode=mode, top_k=top_k)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e), "status": rag_svc.get_status()}), 503


@bp.post("/rag/add")
def rag_add():
    body = request.get_json(silent=True) or {}
    content = body.get("content") or ""
    if not content.strip():
        return jsonify({"error": "content is required"}), 400
    source = body.get("source", "manual")
    tags = body.get("tags") or []
    if not isinstance(tags, list):
        return jsonify({"error": "tags must be a list"}), 400
    doc_id = body.get("doc_id")
    try:
        entry = rag_svc.insert(content, source=source, tags=tags, doc_id=doc_id)
        return jsonify(entry), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e), "status": rag_svc.get_status()}), 503


@bp.get("/rag/list")
def rag_list():
    filters: dict = {}
    source = request.args.get("source")
    tag = request.args.get("tag")
    if source:
        filters["source"] = source
    if tag:
        filters["tag"] = tag
    docs = rag_svc.list_docs(filters or None)
    return jsonify({"docs": docs, "count": len(docs)})


@bp.get("/rag/docs/live")
def rag_docs_live():
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 50))
    return jsonify(rag_svc.list_docs_live(page=page, page_size=page_size))


@bp.get("/rag/docs/counts")
def rag_docs_counts():
    return jsonify(rag_svc.get_doc_status_counts())


# ---------------------------------------------------------------------------
# Ingest control endpoints
# ---------------------------------------------------------------------------

@bp.get("/ingest/status")
def ingest_status():
    return jsonify(ingest_svc.get_status())


@bp.post("/ingest/trigger")
def ingest_trigger():
    ingest_svc.trigger_scan()
    return jsonify({"triggered": True})


@bp.get("/ingest/log")
def ingest_log():
    limit = int(request.args.get("limit", 50))
    return jsonify({"log": ingest_svc.get_log(limit=limit)})
