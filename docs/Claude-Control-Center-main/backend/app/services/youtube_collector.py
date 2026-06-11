from __future__ import annotations

"""YouTube research using yt-dlp."""

import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import yt_dlp  # type: ignore
    _YTDLP_AVAILABLE = True
except ImportError:
    _YTDLP_AVAILABLE = False


def _check_available() -> None:
    if not _YTDLP_AVAILABLE:
        raise RuntimeError("yt-dlp is not installed. Run: pip install yt-dlp")


def search_youtube(query: str, max_results: int = 10) -> list[dict]:
    """Search YouTube and return video metadata."""
    _check_available()
    results: list[dict] = []
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": f"ytsearch{max_results}",
        "noplaylist": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)
        except Exception as exc:
            logger.warning("youtube_collector: search failed: %s", exc)
            return []

    entries = info.get("entries", []) if info else []
    for entry in entries:
        if not entry:
            continue
        results.append({
            "video_id": entry.get("id", ""),
            "title": entry.get("title", ""),
            "uploader": entry.get("uploader") or entry.get("channel", ""),
            "duration": entry.get("duration"),
            "view_count": entry.get("view_count"),
            "url": entry.get("url") or entry.get("webpage_url", ""),
            "thumbnail": entry.get("thumbnail", ""),
        })
    return results


def get_transcript(video_url: str) -> dict:
    """Download subtitles for a YouTube video. Falls back to description + title."""
    _check_available()
    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitlesformat": "vtt",
            "skip_download": True,
            "outtmpl": os.path.join(tmpdir, "%(id)s.%(ext)s"),
        }
        info: dict = {}
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True) or {}
        except Exception as exc:
            logger.warning("youtube_collector: transcript download failed: %s", exc)

        video_id = info.get("id", "")
        title = info.get("title", "")
        duration = info.get("duration")
        description = info.get("description", "")

        # Try to read subtitle file
        transcript_text = ""
        language = ""
        for f in Path(tmpdir).glob(f"{video_id}*.vtt"):
            try:
                raw = f.read_text(encoding="utf-8", errors="ignore")
                # Strip VTT formatting
                lines = []
                for line in raw.splitlines():
                    line = line.strip()
                    if line and not line.startswith("WEBVTT") and "-->" not in line and not line.isdigit():
                        lines.append(line)
                transcript_text = " ".join(lines)
                language = f.stem.split(".")[-1] if "." in f.stem else "en"
                break
            except Exception:
                continue

        if not transcript_text:
            # Fallback to description
            transcript_text = f"{title}\n\n{description}"[:3000]
            language = "description"

        return {
            "video_id": video_id,
            "title": title,
            "transcript_text": transcript_text,
            "language": language,
            "duration": duration,
        }


def collect_channel(channel_url: str, max_videos: int = 20) -> list[dict]:
    """Extract recent video metadata from a channel."""
    _check_available()
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "playlistend": max_videos,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(channel_url, download=False)
        except Exception as exc:
            logger.warning("youtube_collector: channel collect failed: %s", exc)
            return []

    entries = info.get("entries", []) if info else []
    results = []
    for entry in entries[:max_videos]:
        if not entry:
            continue
        results.append({
            "video_id": entry.get("id", ""),
            "title": entry.get("title", ""),
            "uploader": entry.get("uploader") or entry.get("channel", ""),
            "duration": entry.get("duration"),
            "view_count": entry.get("view_count"),
            "url": entry.get("url") or entry.get("webpage_url", ""),
            "thumbnail": entry.get("thumbnail", ""),
        })
    return results
