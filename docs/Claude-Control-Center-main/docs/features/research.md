# Research Pipeline

The Research feature (`/research`) allows you to automate deep-dive information gathering from multiple online sources, saving the results directly to your workspace or Obsidian vault.

## Creating a Research Job
A Research Job defines a query and the sources to be searched:

### Sources
- **YouTube**: Searches for relevant videos and can extract transcripts (requires `yt-dlp`).
- **Reddit**: Searches specific subreddits or all of Reddit for discussions (requires Reddit API credentials).
- **Web**: Uses **Firecrawl** to perform deep web searches and extract clean markdown content from pages.

### Parameters
- **Title**: A name for the job.
- **Query**: The main search term or question.
- **Max Results**: Limit the number of items fetched per source.
- **Target Vault**: Optionally select an Obsidian vault to save the research findings.

## Job Management
- **Queue**: Research jobs run in the background. You can monitor their progress (Queued, Running, Completed, Failed).
- **Results View**: Inspect the raw data fetched for each job before processing.
- **Export**: Send the research summary and sources to an Obsidian note or a local markdown file.

## Prerequisites & Setup

Set the following in `backend/.env` for full source support:

### Reddit
```sh
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

### Firecrawl (Web Search)
```sh
FIRECRAWL_API_KEY=...
```

### YouTube
Requires the `yt-dlp` Python package to be installed in the backend environment (included in `requirements.txt`).

## Technical Details
- **Pipeline**: The `research_pipeline_service` handles the orchestration of different collectors.
- **Persistence**: Jobs and their results are stored in `backend/data/research_jobs.json`.
