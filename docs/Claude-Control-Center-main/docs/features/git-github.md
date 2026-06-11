# Git & GitHub Integration

Claude Control Center bridges your local development environment with your GitHub workflow, providing a unified view of your repositories, PRs, and issues.

## Local Git Management

### Repository Roots (`/github/roots`)
You can define multiple "Roots" — base directories where your Git repositories are located. The dashboard automatically discovers all `.git` repositories within these roots.

### Branch Browser
For any discovered repository, you can view the list of local and remote branches. This helps you quickly see what you're working on across all your projects.

### Commit Activity
The Activity tab provides a consolidated timeline of recent commits across all your watched repositories. It's a great way to see your daily progress at a glance.

---

## GitHub Integration (`/github`)

By providing a **GitHub Personal Access Token (PAT)** in `backend/.env`, you unlock enhanced GitHub features:

### Pull Requests
Lists all open PRs you've created or are assigned to review. Includes PR status, labels, and links directly to GitHub.

### Issues
Lists GitHub issues assigned to you. Stay on top of your tasks without leaving the dashboard.

### Status Monitor
Displays your GitHub API rate limit status and the last time your GitHub data was refreshed.

## Configuration

Set the following in `backend/.env`:
```sh
GITHUB_TOKEN=your_personal_access_token
```

## Security
- **Local Only**: Your GitHub token is stored locally on your machine and is only used by the backend to communicate with the GitHub API.
- **Snapshot Caching**: Data is cached in `backend/data/github_snapshot.json` to minimize API calls and respect rate limits.
