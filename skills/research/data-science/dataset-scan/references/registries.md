# Dataset registry endpoints

Three public registries the scan queries. None require auth for read.

## Hugging Face Datasets

- **List endpoint:** `GET https://huggingface.co/api/datasets`
- **Useful params:**
  - `search=<term>` — keyword in name/tags/description.
  - `filter=<tag>` — repeatable, e.g. `filter=language:en&filter=task_categories:image-classification`.
  - `sort=downloads` or `sort=likes` or `sort=lastModified`.
  - `direction=-1` for descending.
  - `limit=100` (max 100; page with `&offset=`).
  - `full=true` — include `cardData`, license, tags, size category.
- **Detail endpoint:** `GET https://huggingface.co/api/datasets/<id>`.
- **Response fields used:** `id`, `author`, `lastModified`, `downloads`,
  `likes`, `tags` (list), `cardData.license`, `cardData.size_categories`.
- **Rate limit:** ~1000 req/hr unauthenticated; very generous for scans.
- **Card data quirk:** `cardData` may be `null` or missing license.
  Treat as `unknown`.

## OpenML

- **Datasets list endpoint:** `GET https://www.openml.org/api/v1/json/data/list`
  - Optional filters: `tag/<tag>`, `data_name/<substr>`, `limit/<N>`,
    `offset/<N>`, `status/active`.
  - Example: `https://www.openml.org/api/v1/json/data/list/tag/credit/limit/50`
- **Detail endpoint:** `GET https://www.openml.org/api/v1/json/data/<did>`.
- **Response fields used:** `did`, `name`, `version`, `format`,
  `NumberOfInstances`, `NumberOfFeatures`, `NumberOfClasses`,
  `MajorityClassSize`, `MinorityClassSize`, `license`, `upload_date`.
- **Quirk:** date filtering is not native; pull a list and filter
  client-side by `upload_date`.
- **Rate limit:** unauthenticated requests OK; respect a 1s pause
  between paged calls.

## data.gov (CKAN)

- **Search endpoint:**
  `GET https://catalog.data.gov/api/3/action/package_search?q=<term>&rows=50&sort=metadata_modified+desc`
- **Response shape:** CKAN. The `result.results` list contains
  `name`, `title`, `notes`, `organization.title`, `metadata_modified`,
  `resources` (list with `format`, `url`, `size`), `tags`, `license_id`.
- **Quirk:** government source. Many entries are dataset *records*
  not raw files — check `resources` for downloadable formats
  (`CSV`, `JSON`, `GeoJSON`, `Shapefile`).
- **Rate limit:** undocumented; conservative throttling (1 req/s) is
  fine.

## Common normalization

Different schemas; map each result to a shared row before merging:

```
{
  "source": "huggingface" | "openml" | "datagov",
  "id": "<source-specific id>",
  "title": "<human title>",
  "url": "<canonical browse URL>",
  "updated": "<YYYY-MM-DD>",
  "size": "<human size or null>",
  "license": "<spdx code or null>",
  "downloads_or_proxy": <int or null>,
  "tags": [<str>],
  "topic_match": "<which input topic this row hit>"
}
```
