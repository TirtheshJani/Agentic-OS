# Kaggle public API — usage notes

Kaggle ships an official CLI (`pip install kaggle`) and a thin REST
surface at `https://www.kaggle.com/api/v1/`. The CLI wraps the REST
endpoints and handles auth from `~/.kaggle/kaggle.json`.

## Auth

```bash
# ~/.kaggle/kaggle.json (chmod 600)
{ "username": "tjani", "key": "abcdef0123..." }
```

The CLI reads this file automatically. Raw HTTP calls need
`Authorization: Basic <base64(username:key)>`.

## Endpoints we use

| Purpose | CLI | REST |
|---|---|---|
| List competitions | `kaggle competitions list --sort-by latestDeadline --page-size 50` | `GET /competitions/list?sortBy=latestDeadline` |
| Search competitions | `kaggle competitions list --search "<term>"` | `GET /competitions/list?search=<term>` |
| List datasets | `kaggle datasets list --sort-by hottest --page-size 50` | `GET /datasets/list?sortBy=hottest` |
| Search datasets | `kaggle datasets list --search "<term>" --sort-by published` | `GET /datasets/list?search=<term>&sortBy=published` |
| List notebooks (kernels) | `kaggle kernels list --sort-by hotness --page-size 50` | `GET /kernels/list?sortBy=hotness` |
| Filter notebooks by competition | `kaggle kernels list --competition <slug>` | `GET /kernels/list?competition=<slug>` |

## Sort fields

- Competitions: `grouped`, `prize`, `earliestDeadline`, `latestDeadline`,
  `numberOfTeams`, `recentlyCreated`.
- Datasets: `hottest`, `votes`, `updated`, `active`, `published`.
- Kernels: `hotness`, `commentCount`, `dateCreated`, `dateRun`,
  `scoreAscending`, `scoreDescending`, `viewCount`, `voteCount`.

## Rate limits

Undocumented. Empirically a few requests per second is safe; pause 1s
between calls when paging. There is no `Retry-After`; HTTP 429 means
sleep 30s and try once more.

## Categories worth tracking

`tabular`, `computer-vision`, `nlp`, `time-series`, `tabular-playground`.
Competition `tags` are returned in the JSON; filter client-side.

## Output JSON shape (competition)

Key fields used by the digest:

- `ref` (slug, e.g. `titanic`)
- `title`
- `url` (`https://www.kaggle.com/c/<ref>`)
- `deadline` (ISO date)
- `reward` (string, may be empty)
- `teamCount`
- `tags` (list of `{name, fullPath}`)
- `category` (Featured, Research, Playground, Getting Started,
  Community)

## Output JSON shape (notebook / kernel)

- `ref` (e.g. `<user>/<slug>`)
- `title`
- `author`
- `totalVotes`
- `lastRunTime`
- `language`
- `kernelType` (`script` | `notebook`)
