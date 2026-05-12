---
name: article-extractor
description: Extract clean article text from a URL (blog post, news article, tutorial) without ads, nav, or clutter. Uses Mozilla Readability (reader-cli) or trafilatura, with a curl+HTMLParser fallback. Use when the user provides a URL and asks to "extract this article", "save this blog post", "get the text from this page", or feeds an article into the research workflow. Saves to vault/raw/articles/.
license: MIT
allowed-tools: Bash, Write
metadata:
  status: authored
  domain: research
  mode: local
  mcp-server: none
  external-apis: []
  outputs: [vault/raw/articles/<slug>.txt]
  source: https://github.com/michalparkola/tapestry-skills-for-claude-code/tree/main/article-extractor
  source-license: MIT
  dependencies: ["reader-cli (npm) or trafilatura (pip), curl+python3 fallback"]
---

# Article Extractor

Extract the main content from a web article, stripped of navigation, ads, sidebars, and newsletter prompts. Saves clean text to `vault/raw/articles/`.

## When to Use

Trigger phrases:
- "extract this article"
- "save this blog post"
- "get the text from <URL>"
- "download <URL> as plain text"

Pairs with `youtube-transcript`, `scan`, and `research-lookup` for feeding external content into the research workflow.

## Priority order

1. Detect which extraction tool is available
2. Download and extract content
3. Pull article title for the filename
4. Clean filename for filesystem compatibility
5. Save under `vault/raw/articles/<title>.txt`
6. Show a 10-line preview

## Tool detection

Try in this order:

1. **`reader`** (Mozilla Readability, best for general articles)
   ```bash
   command -v reader && echo "using reader"
   # install: npm install -g @mozilla/readability-cli  (or reader-cli)
   ```

2. **`trafilatura`** (Python, best for blogs/news/multilingual)
   ```bash
   command -v trafilatura && echo "using trafilatura"
   # install: pip3 install trafilatura
   ```

3. **curl + HTMLParser fallback** (no deps, lower fidelity)

## Extraction methods

### Method 1: reader

```bash
reader "<URL>" > temp_article.txt
TITLE=$(head -n 1 temp_article.txt | sed 's/^# //')
```

Mozilla Readability handles most news sites and blogs cleanly.

### Method 2: trafilatura

```bash
METADATA=$(trafilatura --URL "<URL>" --json)
TITLE=$(echo "$METADATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('title','Article'))")
trafilatura --URL "<URL>" --output-format txt --no-comments > temp_article.txt
```

Useful flags:
- `--no-comments` skip comment sections
- `--no-tables` skip data tables
- `--precision` favor precision over recall
- `--recall` extract more content (may include some noise)

### Method 3: curl + HTMLParser fallback

```bash
TITLE=$(curl -fsSL "<URL>" | grep -oP '<title>\K[^<]+' | head -n 1)
TITLE=${TITLE%% - *}
TITLE=${TITLE%% | *}

curl -fsSL "<URL>" | python3 -c "
from html.parser import HTMLParser
import sys

class ArticleExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_content = False
        self.content = []
        self.skip = {'script', 'style', 'nav', 'header', 'footer', 'aside', 'form'}
    def handle_starttag(self, tag, attrs):
        if tag not in self.skip and tag in {'p', 'article', 'main'}:
            self.in_content = True
        if tag in {'h1', 'h2', 'h3'}:
            self.content.append('')
    def handle_data(self, data):
        if self.in_content and data.strip():
            self.content.append(data.strip())

p = ArticleExtractor()
p.feed(sys.stdin.read())
print('\n\n'.join(p.content))
" > temp_article.txt
```

Less reliable but works without dependencies.

## Filename hygiene

```bash
FILENAME=$(echo "$TITLE" \
    | tr '/' '-' \
    | tr ':' '-' \
    | tr '?' '' \
    | tr '"' '' \
    | tr '<>' '' \
    | tr '|' '-' \
    | cut -c 1-80 \
    | sed 's/ *$//; s/^ *//')
FILENAME="${FILENAME}.txt"
```

Strip `/`, `:`, `?`, `"`, `<`, `>`, `|`. Cap at 80 chars.

## Complete workflow

```bash
URL="$1"
[ -z "$URL" ] && { echo "usage: article-extract <url>"; exit 1; }

mkdir -p vault/raw/articles

if command -v reader >/dev/null; then
    TOOL=reader
elif command -v trafilatura >/dev/null; then
    TOOL=trafilatura
else
    TOOL=fallback
fi
echo "Using: $TOOL"

case $TOOL in
    reader)
        reader "$URL" > temp_article.txt
        TITLE=$(head -n 1 temp_article.txt | sed 's/^# //')
        ;;
    trafilatura)
        METADATA=$(trafilatura --URL "$URL" --json)
        TITLE=$(echo "$METADATA" | python3 -c "import json,sys; print(json.load(sys.stdin).get('title','Article'))")
        trafilatura --URL "$URL" --output-format txt --no-comments > temp_article.txt
        ;;
    fallback)
        TITLE=$(curl -fsSL "$URL" | grep -oP '<title>\K[^<]+' | head -n 1)
        TITLE=${TITLE%% - *}
        # ...HTMLParser block above...
        ;;
esac

FILENAME=$(echo "$TITLE" | tr '/' '-' | tr ':' '-' | tr '?' '' | tr '"' '' | tr '<>' '' | tr '|' '-' | cut -c 1-80 | sed 's/ *$//; s/^ *//')
mv temp_article.txt "vault/raw/articles/${FILENAME}.txt"

echo "Extracted: $TITLE"
echo "Saved to: vault/raw/articles/${FILENAME}.txt"
echo "Preview:"
head -n 10 "vault/raw/articles/${FILENAME}.txt"
```

## Error handling

| Issue                  | Action                                                       |
|------------------------|--------------------------------------------------------------|
| No extraction tool     | Try alternate tool; offer install command; fall back to curl |
| Paywall / login wall   | Report failure; do not retry                                 |
| Heavy-JS site          | reader and trafilatura may fail; fallback returns near-empty |
| Invalid URL            | Check format; report curl error verbatim                     |
| Empty extraction       | Show user; offer alternate tool                              |

## Best practices

- Always show a 10-line preview after extraction
- Verify content looks like an article, not nav text
- Tell the user which tool was used
- Cap filename length at 80 chars
- Save under `vault/raw/articles/` so `vault-cleanup` and `scan` can find them

## Related skills

- `youtube-transcript` - same pattern for video content
- `scan` - ingest articles into the morning digest
- `research-lookup`, `paper-search` - cross-reference articles against academic sources
- `vault-cleanup` - sweep stale articles out of `vault/raw/`
