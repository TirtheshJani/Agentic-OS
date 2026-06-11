from __future__ import annotations

import os
from pathlib import Path
from app.config import ANTIGRAVITY_DIR

def list_memory_files() -> list[dict]:
    knowledge_dir = ANTIGRAVITY_DIR / "knowledge"
    if not knowledge_dir.exists() or not knowledge_dir.is_dir():
        return []
    
    files = []
    for file_path in knowledge_dir.rglob("*"):
        if file_path.is_file():
            try:
                stats = file_path.stat()
                files.append({
                    "filename": str(file_path.relative_to(knowledge_dir)),
                    "path": str(file_path),
                    "size": stats.st_size,
                    "modified": stats.st_mtime
                })
            except Exception:
                pass
    return files
