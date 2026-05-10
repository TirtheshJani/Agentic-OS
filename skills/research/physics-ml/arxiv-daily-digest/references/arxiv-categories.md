# arXiv categories used by arxiv-daily-digest

## Defaults
- `cs.LG` — Machine Learning (general).
- `stat.ML` — Statistical ML.
- `cs.CL` — Computation and Language.
- `cs.CV` — Computer Vision.
- `physics.med-ph` — Medical Physics (healthcare overlap).

## Tag hints (for filtering within a category)
- Diffusion: `diffusion`, `score-based`, `DDPM`.
- Attention/transformers: `attention`, `transformer`, `MoE`.
- Scaling laws: `scaling`, `compute-optimal`, `chinchilla`.
- Healthcare: `clinical`, `radiology`, `pathology`, `EHR`.

## Endpoint
`http://export.arxiv.org/api/query?search_query=cat:<cat>&sortBy=submittedDate&sortOrder=descending&max_results=50`

Time window: prefer `submittedDate:[YYYYMMDDhhmm TO YYYYMMDDhhmm]` to
reduce noise.
