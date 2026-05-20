# Dependencies

## Required CLI Tools

```bash
# parallel-cli (PRIMARY: for web search and URL extraction)
curl -fsSL https://parallel.ai/install.sh | bash
# Or: uv tool install "parallel-web-tools[cli]"
# Authenticate: parallel-cli auth
```

## Required Python Packages

```bash
pip install requests  # For citation verification
```

## Required System Tools

```bash
# For PDF generation
brew install pandoc  # macOS
apt-get install pandoc  # Linux

# For LaTeX (PDF generation)
brew install --cask mactex  # macOS
apt-get install texlive-xetex  # Linux
```

Check dependencies:

```bash
python scripts/generate_pdf.py --check-deps
```
