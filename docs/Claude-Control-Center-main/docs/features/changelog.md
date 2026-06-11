# Changelog & What's New

Stay up to date with the latest Claude Code improvements and releases directly from the dashboard.

## Releases (`/changelog`)
The Releases tab fetches the official `CHANGELOG.md` from the Claude Code GitHub repository.

- **Version History**: Lists all releases in reverse chronological order.
- **Change Details**: Displays a bulleted list of features, bug fixes, and improvements for each version.
- **Auto-Refresh**: The changelog is cached for one hour, but you can trigger a manual refresh to check for the very latest updates.

## What's New
The What's New tab provides a more editorial view of recent changes, scraped from the official Claude Code documentation.

- **Weekly Updates**: Grouped by week, these updates highlight major feature additions and architectural shifts.
- **Tags**: Entries are tagged (e.g., `feature`, `improvement`, `fix`) for quick scanning.
- **Rich Content**: Includes descriptions and links to relevant documentation.

## Technical Details
- **Scraping**: The backend uses `httpx` and `BeautifulSoup4` to fetch and parse the content.
- **Caching**: Both feeds are cached in memory with a 1-hour TTL to prevent excessive external requests and ensure a fast UI experience.
- **Privacy**: No user data is sent during these requests; the backend simply fetches public markdown and HTML files.
