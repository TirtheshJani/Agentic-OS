from __future__ import annotations

import os
from pathlib import Path
from app.config import ANTIGRAVITY_DIR

def list_skills() -> list[dict]:
    bin_dir = ANTIGRAVITY_DIR / "bin"
    if not bin_dir.exists() or not bin_dir.is_dir():
        return []
    
    skills = []
    for file_path in bin_dir.iterdir():
        if file_path.is_file():
            try:
                stats = file_path.stat()
                is_executable = os.access(file_path, os.X_OK)
                skills.append({
                    "name": file_path.name,
                    "path": str(file_path),
                    "size": stats.st_size,
                    "modified": stats.st_mtime,
                    "executable": is_executable
                })
            except Exception:
                pass
    return skills

def add_skill(name: str, content: str) -> dict:
    try:
        bin_dir = ANTIGRAVITY_DIR / "bin"
        bin_dir.mkdir(parents=True, exist_ok=True)
        
        target_file = bin_dir / name
        target_file.write_text(content, encoding="utf-8")
        
        # Make executable
        os.chmod(target_file, 0o755)
        
        return {"success": True, "name": name, "path": str(target_file)}
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_skill(name: str) -> dict:
    try:
        target_file = ANTIGRAVITY_DIR / "bin" / name
        if target_file.exists():
            target_file.unlink()
            return {"success": True}
        return {"success": False, "error": "Not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}
