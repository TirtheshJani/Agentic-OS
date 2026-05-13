# Healthcare arXiv categories and keyword filter

## Bucket A — pass-through categories

Every paper in these primary categories counts as healthcare without
keyword filtering.

### q-bio (Quantitative Biology) subcategories

- `q-bio.BM` — Biomolecules
- `q-bio.CB` — Cell Behavior
- `q-bio.GN` — Genomics
- `q-bio.MN` — Molecular Networks
- `q-bio.NC` — Neurons and Cognition
- `q-bio.OT` — Other
- `q-bio.PE` — Populations and Evolution
- `q-bio.QM` — Quantitative Methods (most healthcare-ML-adjacent)
- `q-bio.SC` — Subcellular Processes
- `q-bio.TO` — Tissues and Organs

### Other pass-through

- `physics.med-ph` — Medical Physics (imaging, dosimetry,
  radiotherapy).
- `stat.AP` — Statistics Applications. Mixed; many epidemiology and
  clinical-trial-stats papers. Treat as pass-through but flag to user
  if the day's batch is mostly non-medical (e.g. sports analytics).

## Bucket B — keyword-filtered ML categories

- `cs.LG` — Machine Learning
- `cs.CV` — Computer Vision (most medical imaging ML papers list
  here as primary)
- `cs.CL` — Computation and Language (clinical NLP, EHR
  summarization)

## Default healthcare keyword filter

Match title + abstract, case-insensitive, whole-word where the engine
supports it.

```
clinical
clinician
patient
diagnosis
diagnostic
prognosis
prognostic
radiology
radiograph
chest x-ray
mammography
ct scan
mri
ultrasound
histopathology
pathology
oncology
cancer
tumor
tumour
cardiology
ecg
ekg
electrocardiogram
ehr
electronic health record
icd-10
icu
emergency department
mortality
sepsis
medical imaging
medical image
biomedical
healthcare
health care
drug discovery
drug design
biomarker
mimic-iii
mimic-iv
```

Tag-hint synonyms (for tagging in the digest frontmatter):
- `radiology|radiograph|chest x-ray|ct scan|mri` → tag `medical-imaging`
- `ehr|electronic health record|icd-10` → tag `clinical-nlp`
- `oncology|cancer|tumor|tumour` → tag `oncology`
- `cardiology|ecg|ekg|electrocardiogram` → tag `cardiology`
