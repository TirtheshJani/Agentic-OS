# Default tracked benchmarks

Used by `benchmark-tracker` when no `benchmarks` input is supplied.
Each entry maps a human label to a PapersWithCode `task` slug
(canonical) plus the metric the task's leaderboard ranks by. Verify
slugs against `https://paperswithcode.com/api/v1/tasks/<slug>/`
before adding new rows; the slug appears in the URL of the task page.

| Label | PWC task slug | Metric | Higher is better |
|---|---|---|---|
| ImageNet (top-1) | image-classification-on-imagenet | Top 1 Accuracy | yes |
| COCO detection (mAP) | object-detection-on-coco | box AP | yes |
| GLUE (avg) | natural-language-understanding-on-glue | Average | yes |
| SuperGLUE (avg) | natural-language-understanding-on-superglue | Score | yes |
| MMLU (5-shot) | multi-task-language-understanding-on-mmlu | Average (5-shot) | yes |
| HumanEval (pass@1) | code-generation-on-humaneval | Pass@1 | yes |
| GSM8K (test) | arithmetic-reasoning-on-gsm8k | Accuracy | yes |
| HellaSwag | sentence-completion-on-hellaswag | Accuracy | yes |
| ARC-Challenge | common-sense-reasoning-on-arc-challenge | Accuracy | yes |
| C4-MMLU is NOT a benchmark | — | — | — |

## PWC endpoint shape

```
GET https://paperswithcode.com/api/v1/tasks/<slug>/evaluations/
```

Response: paginated. Each result has `id`, `metrics` (list of
`{name, value}`), `evaluation_date`, `paper` (with `title` and `url`),
`model_name`, `external_source_url` (often a GitHub repo).

Sort by `metric_value` descending after picking the matching metric
name. The API does not sort for you across pages; pull pages 1-3 and
sort client-side.

## Rate limits

Undocumented. Conservative pace (1 req/s) is fine. 429 is rare; back
off 30s and retry once if it happens.

## Alternative source: HF Open LLM Leaderboard

For LLM benchmarks (MMLU, HellaSwag, ARC, etc.) the Hugging Face
Open LLM Leaderboard often updates faster than PWC. JSON endpoint
unstable; HTML fetch + parse is acceptable when PWC is stale, but
note it in the diff report ("source: hf-leaderboard").

URL: https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard
