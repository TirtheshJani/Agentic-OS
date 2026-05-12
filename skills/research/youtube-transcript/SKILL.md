---
name: youtube-transcript
description: Download a YouTube video's transcript (subtitles or captions) via yt-dlp, with Whisper fallback when no captions exist. Use when the user provides a YouTube URL and asks to "get the transcript", "download subtitles", "transcribe this video", or wants to feed video content into a research workflow. Outputs deduplicated plain text to vault/raw/transcripts/. Requires yt-dlp.
license: MIT
allowed-tools: Bash, Read, Write
metadata:
  status: authored
  domain: research
  mode: local
  mcp-server: none
  external-apis: []
  outputs: [vault/raw/transcripts/<slug>.txt]
  source: https://github.com/michalparkola/tapestry-skills-for-claude-code/tree/main/youtube-transcript
  source-license: MIT
  dependencies: [yt-dlp, "openai-whisper (optional, last-resort fallback)"]
---

# YouTube Transcript Downloader

Pull transcripts from YouTube videos using `yt-dlp`. Falls back to local `openai-whisper` when no captions are available.

## When to Use

Trigger phrases:
- "transcript of <YouTube URL>"
- "download subtitles from <URL>"
- "transcribe this video"
- "get captions for <URL>"

Pairs with the `scan` and `research-lookup` skills for ingesting video content into the morning digest.

## Priority order

1. Confirm `yt-dlp` is installed; install if missing
2. List available subtitles
3. Try manual subtitles (`--write-sub`)
4. Fall back to auto-generated (`--write-auto-sub`)
5. Last resort: download audio and transcribe via local Whisper (requires user confirmation)
6. Convert VTT to deduplicated plain text
7. Save under `vault/raw/transcripts/<video-title>.txt`

## Install check

```bash
command -v yt-dlp || which yt-dlp
```

If missing:

| Platform           | Command                                     |
|--------------------|---------------------------------------------|
| Windows (Scoop)    | `scoop install yt-dlp`                      |
| Windows (pip)      | `pip install yt-dlp`                        |
| macOS (Homebrew)   | `brew install yt-dlp`                       |
| Linux (apt)        | `sudo apt update && sudo apt install -y yt-dlp` |
| Cross-platform     | `pip3 install yt-dlp`                       |

If install fails, point user to https://github.com/yt-dlp/yt-dlp#installation and stop.

## List subtitles first

```bash
yt-dlp --list-subs "<URL>"
```

Look for manual subs (higher quality), auto-generated subs (usually available), and language options.

## Download strategy

### Option 1: Manual subtitles (preferred)

```bash
yt-dlp --write-sub --skip-download --output "transcript_temp" "<URL>"
```

### Option 2: Auto-generated subtitles (fallback)

```bash
yt-dlp --write-auto-sub --skip-download --output "transcript_temp" "<URL>"
```

Both produce a `transcript_temp.<lang>.vtt` file.

### Option 3: Whisper transcription (last resort)

ONLY if both manual and auto subtitles are unavailable.

1. Show duration and audio size, ask user before downloading:
   ```bash
   yt-dlp --print "%(duration)s %(filesize_approx)s %(title)s" -f bestaudio "<URL>"
   ```
2. Confirm whisper installed (`command -v whisper`). If not, ask before `pip install openai-whisper` (1-3 GB model).
3. Download audio: `yt-dlp -x --audio-format mp3 --output "audio_%(id)s.%(ext)s" "<URL>"`
4. Transcribe: `whisper audio_<id>.mp3 --model base --output_format vtt`
5. After completion, ask before deleting audio file.

Stick to `--model base` (1 GB, good accuracy/speed balance) unless user requests otherwise.

## Post-processing: deduplicate VTT to plain text

YouTube's auto-generated VTT contains duplicate lines (progressive captions with overlapping timestamps). Always deduplicate while preserving original speaking order:

```bash
VIDEO_TITLE=$(yt-dlp --print "%(title)s" "<URL>" | tr '/:?"' '____')
VTT_FILE=$(ls transcript_temp.*.vtt | head -n 1)

mkdir -p vault/raw/transcripts

python3 -c "
import re
seen = set()
with open('$VTT_FILE') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith(('WEBVTT', 'Kind:', 'Language:')) or '-->' in line:
            continue
        clean = re.sub('<[^>]*>', '', line)
        clean = clean.replace('&amp;', '&').replace('&gt;', '>').replace('&lt;', '<')
        if clean and clean not in seen:
            print(clean)
            seen.add(clean)
" > "vault/raw/transcripts/${VIDEO_TITLE}.txt"

rm "$VTT_FILE"
echo "Saved: vault/raw/transcripts/${VIDEO_TITLE}.txt"
```

## Complete workflow

```bash
VIDEO_URL="$1"
[ -z "$VIDEO_URL" ] && { echo "usage: yt-transcript <url>"; exit 1; }

# 1. Ensure yt-dlp
command -v yt-dlp >/dev/null || pip3 install yt-dlp

# 2. List subs
echo "Available subtitles:"
yt-dlp --list-subs "$VIDEO_URL"

# 3. Try manual then auto
if yt-dlp --write-sub --skip-download --output "transcript_temp" "$VIDEO_URL" 2>/dev/null; then
    echo "Manual subs downloaded."
elif yt-dlp --write-auto-sub --skip-download --output "transcript_temp" "$VIDEO_URL" 2>/dev/null; then
    echo "Auto-generated subs downloaded."
else
    echo "No subs available. Whisper fallback requires confirmation."
    exit 2
fi

# 4. Convert to plain text (see python block above)
```

For Whisper fallback, branch to the Option 3 flow above with explicit user prompts at each step.

## Error handling

| Issue                     | Action                                                          |
|---------------------------|-----------------------------------------------------------------|
| yt-dlp not installed      | Auto-install via pip/scoop/brew/apt; fall back to manual link   |
| No subtitles              | List subs to confirm, then offer Whisper fallback               |
| Private or age-restricted | Report the yt-dlp error verbatim; do not retry blindly          |
| Whisper install fails     | Report missing system deps (ffmpeg, rust); offer manual install |
| Multiple languages        | Default downloads all; pass `--sub-langs en` for English only   |

## Best practices

- Run `--list-subs` first; do not guess what's available
- Ask before large downloads (audio files, Whisper models)
- Clean up temp `.vtt` files after producing the `.txt`
- Save outputs under `vault/raw/transcripts/` so the vault-cleanup and scan skills can find them

## Related skills

- `scan` - ingests fresh transcripts into the morning digest
- `research-lookup` - cross-reference video content against papers
- `article-extractor` - same pattern for web articles
- `vault-cleanup` - sweep stale transcripts out of `vault/raw/`
