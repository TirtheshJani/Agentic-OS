---
title: Managed Agents Integration Guide
type: guide
tags: [managed-agents, integration, api]
created: 2026-04-10
---

# Managed Agents Integration Guide

How the Claude Control Center connects to the Anthropic Managed Agents API.

## Architecture

```
Control Center Frontend  →  Flask Backend  →  Anthropic API
     (React)                  (Proxy)          (/v1/agents, /v1/sessions)
```

The backend proxies all requests to Anthropic's API, adding authentication headers and caching responses locally for offline browsing.

## Setup

1. Get an API key from the [Anthropic Console](https://console.anthropic.com)
2. Add to `backend/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Restart the backend server

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/status` | GET | Check if API key is configured |
| `/api/agents` | GET/POST | List/create agents |
| `/api/agents/:id` | GET/PUT/DELETE | Agent CRUD |
| `/api/agents/environments` | GET/POST | List/create environments |
| `/api/agents/environments/:id` | GET/PUT/DELETE | Environment CRUD |
| `/api/agents/sessions` | GET/POST | List/create sessions |
| `/api/agents/sessions/:id` | GET | Get session detail |
| `/api/agents/sessions/:id/message` | POST | Send message to session |
| `/api/agents/sessions/:id/events` | GET (SSE) | Stream session events |

## Rate Limits

- Create operations: 60 requests/minute
- Read operations: 600 requests/minute
- The backend tracks rate limits client-side to avoid hitting API limits

## Local Caching

Agent, environment, and session metadata is cached in `backend/data/managed_agents/` as JSON files. This enables:
- Browsing previously created agents when the API is unreachable
- Faster repeated reads
- History of all managed agents activity

## Related

- [[Agent Configuration Templates]]
- [[Environment Templates]]
- [[Advisor Usage Guide]]
