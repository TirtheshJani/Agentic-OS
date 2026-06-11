---
title: Environment Templates
type: reference
tags: [managed-agents, environments, templates]
created: 2026-04-10
---

# Environment Templates

Pre-configured environment setups for managed agent sessions.

## Python Data Science

```json
{
  "name": "Python Data Science",
  "packages": ["numpy", "pandas", "matplotlib", "scikit-learn", "scipy", "seaborn"],
  "network_access": true
}
```

## Node.js Web Development

```json
{
  "name": "Node.js Web",
  "packages": ["typescript", "tsx", "express", "zod", "vitest"],
  "network_access": true
}
```

## Minimal Python

```json
{
  "name": "Python Minimal",
  "packages": ["requests", "beautifulsoup4"],
  "network_access": false
}
```

## Full Stack

```json
{
  "name": "Full Stack",
  "packages": ["python3", "nodejs", "typescript", "flask", "sqlalchemy", "pytest"],
  "network_access": true,
  "files": [
    { "path": "setup.sh", "content": "#!/bin/bash\nnpm install && pip install -r requirements.txt" }
  ]
}
```
