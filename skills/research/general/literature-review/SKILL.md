---
name: literature-review
description: Conduct comprehensive, systematic literature reviews using multiple academic databases (PubMed, arXiv, bioRxiv, Semantic Scholar, etc.). This skill should be used when conducting systematic literature reviews, meta-analyses, research synthesis, or comprehensive literature searches across biomedical, scientific, and technical domains. Creates professionally formatted markdown documents and PDFs with verified citations in multiple citation styles (APA, Nature, Vancouver, etc.).
allowed-tools: Read Write Edit Bash
license: MIT
metadata:
  status: authored
  domain: research/general
  mode: local
  mcp-server: none
  external-apis: [pubmed, arxiv, biorxiv, semantic-scholar]
  skill-author: K-Dense Inc.
---

# Literature Review

## Overview

Conduct systematic, comprehensive literature reviews following rigorous academic methodology. Search multiple literature databases, synthesize findings thematically, verify all citations for accuracy, and generate professional output documents in markdown and PDF formats.

This skill uses the **parallel-web skill** (`parallel-cli search`) as the primary web search tool for broad academic literature discovery, supplemented by specialized database access skills (gget, bioservices, datacommons-client). It provides specialized tools for citation verification, result aggregation, and document generation.

## When to Use This Skill

Use this skill when:
- Conducting a systematic literature review for research or publication
- Synthesizing current knowledge on a specific topic across multiple sources
- Performing meta-analysis or scoping reviews
- Writing the literature review section of a research paper or thesis
- Investigating the state of the art in a research domain
- Identifying research gaps and future directions
- Requiring verified citations and professional formatting

## Visual Enhancement

<!-- TODO: vendor scientific-schematics skill -->

Every literature review should include at least 1-2 figures. Useful diagram types: PRISMA flow diagrams (for systematic reviews), literature search strategy flowcharts, thematic synthesis diagrams, research gap visualization maps, citation network diagrams, conceptual framework illustrations. Until a companion schematic-generation skill is vendored into this repo, draft figure intent during planning and produce figures manually.

---

## Core Workflow

Literature reviews follow a structured, multi-phase workflow:

### Phase 1: Planning and Scoping

1. **Define Research Question**: Use PICO framework (Population, Intervention, Comparison, Outcome) for clinical/biomedical reviews
   - Example: "What is the efficacy of CRISPR-Cas9 (I) for treating sickle cell disease (P) compared to standard care (C)?"

2. **Establish Scope and Objectives**:
   - Define clear, specific research questions
   - Determine review type (narrative, systematic, scoping, meta-analysis)
   - Set boundaries (time period, geographic scope, study types)

3. **Develop Search Strategy**:
   - Identify 2-4 main concepts from research question
   - List synonyms, abbreviations, and related terms for each concept
   - Plan Boolean operators (AND, OR, NOT) to combine terms
   - Select minimum 3 complementary databases
   - **Use the parallel-web skill (`parallel-cli search`) for initial scoping** to quickly gauge the landscape before formal database searches

4. **Set Inclusion/Exclusion Criteria**:
   - Date range (e.g., last 10 years: 2015-2024)
   - Language (typically English, or specify multilingual)
   - Publication types (peer-reviewed, preprints, reviews)
   - Study designs (RCTs, observational, in vitro, etc.)
   - Document all criteria clearly

### Phase 2: Systematic Literature Search

1. **Multi-Database Search**. Always start with parallel-web for broad academic coverage, then supplement with domain-specific databases. Run two parallel-cli searches per topic (one filtered to scholarly domains, one general) and use `parallel-cli extract` to fetch full content from promising URLs. Pair with `gget` (PubMed, bioRxiv, COSMIC, AlphaFold) and `bioservices` (ChEMBL, KEGG, UniProt) for biomedical work, and direct API access for arXiv and Semantic Scholar. See [references/database_strategies.md](references/database_strategies.md) for full parallel-cli command examples and per-database flags.

2. **Document Search Parameters** for every database: date searched, date range, search string, result count. Reproducibility requires this.

3. **Export and Aggregate Results**: export JSON from each database, combine into a single file, then post-process with `scripts/search_databases.py` (deduplicate, format markdown, output).

### Phase 3: Screening and Selection

1. **Deduplication**:
   ```bash
   python search_databases.py results.json --deduplicate --output unique_results.json
   ```
   - Removes duplicates by DOI (primary) or title (fallback)
   - Document number of duplicates removed

2. **Title Screening**:
   - Review all titles against inclusion/exclusion criteria
   - Exclude obviously irrelevant studies
   - Document number excluded at this stage

3. **Abstract Screening**:
   - Read abstracts of remaining studies
   - Apply inclusion/exclusion criteria rigorously
   - Document reasons for exclusion

4. **Full-Text Screening**:
   - Obtain full texts of remaining studies
   - Conduct detailed review against all criteria
   - Document specific reasons for exclusion
   - Record final number of included studies

5. **Create PRISMA Flow Diagram**:
   ```
   Initial search: n = X
   ├─ After deduplication: n = Y
   ├─ After title screening: n = Z
   ├─ After abstract screening: n = A
   └─ Included in review: n = B
   ```

### Phase 4: Data Extraction and Quality Assessment

1. **Extract Key Data** from each included study:
   - Study metadata (authors, year, journal, DOI)
   - Study design and methods
   - Sample size and population characteristics
   - Key findings and results
   - Limitations noted by authors
   - Funding sources and conflicts of interest

2. **Assess Study Quality**:
   - **For RCTs**: Use Cochrane Risk of Bias tool
   - **For observational studies**: Use Newcastle-Ottawa Scale
   - **For systematic reviews**: Use AMSTAR 2
   - Rate each study: High, Moderate, Low, or Very Low quality
   - Consider excluding very low-quality studies

3. **Organize by Themes**:
   - Identify 3-5 major themes across studies
   - Group studies by theme (studies may appear in multiple themes)
   - Note patterns, consensus, and controversies

### Phase 5: Synthesis and Analysis

1. **Create Review Document** from template:
   ```bash
   cp assets/review_template.md my_literature_review.md
   ```

2. **Write Thematic Synthesis** (NOT study-by-study summaries):
   - Organize Results section by themes or research questions
   - Synthesize findings across multiple studies within each theme
   - Compare and contrast different approaches and results
   - Identify consensus areas and points of controversy
   - Highlight the strongest evidence

   Example structure:
   ```markdown
   #### 3.3.1 Theme: CRISPR Delivery Methods

   Multiple delivery approaches have been investigated for therapeutic
   gene editing. Viral vectors (AAV) were used in 15 studies^1-15^ and
   showed high transduction efficiency (65-85%) but raised immunogenicity
   concerns^3,7,12^. In contrast, lipid nanoparticles demonstrated lower
   efficiency (40-60%) but improved safety profiles^16-23^.
   ```

3. **Critical Analysis**:
   - Evaluate methodological strengths and limitations across studies
   - Assess quality and consistency of evidence
   - Identify knowledge gaps and methodological gaps
   - Note areas requiring future research

4. **Write Discussion**:
   - Interpret findings in broader context
   - Discuss clinical, practical, or research implications
   - Acknowledge limitations of the review itself
   - Compare with previous reviews if applicable
   - Propose specific future research directions

### Phase 6: Citation Verification

**CRITICAL**: all citations must be verified before final submission. Run `python scripts/verify_citations.py my_literature_review.md` to extract DOIs, verify they resolve via CrossRef, and generate a verification report. Review the report, fix any failures, re-run until clean. Choose one citation style and apply it consistently (see [references/citation_styles.md](references/citation_styles.md)).

### Phase 7: Document Generation

Generate a PDF with `python scripts/generate_pdf.py my_literature_review.md --citation-style apa --output my_review.pdf`. Style options: apa, nature, chicago, vancouver, ieee. Other flags: `--no-toc`, `--no-numbers`, `--check-deps`.

**Quality checklist before submission:**
- [ ] All DOIs verified with verify_citations.py
- [ ] Citations formatted consistently
- [ ] PRISMA flow diagram included (for systematic reviews)
- [ ] Search methodology fully documented
- [ ] Inclusion/exclusion criteria clearly stated
- [ ] Results organized thematically (not study-by-study)
- [ ] Quality assessment completed
- [ ] Limitations acknowledged
- [ ] References complete and accurate
- [ ] PDF generates without errors

## Database-Specific Search Guidance

See [references/database_strategies.md](references/database_strategies.md) for comprehensive per-database guidance covering PubMed/PubMed Central, bioRxiv/medRxiv, arXiv, Semantic Scholar, ChEMBL, UniProt, KEGG, COSMIC, AlphaFold, PDB, and citation chaining (forward and backward) with `parallel-cli` examples and Google Scholar / Semantic Scholar / OpenAlex API usage.

## Citation Style Guide

See [references/citation_styles.md](references/citation_styles.md) for the full APA (7th edition), Nature, Vancouver, AMA, IEEE, and Chicago formats with examples for in-text citations and reference list entries.

**Always verify citations** with `verify_citations.py` before finalizing.

### Prioritizing High-Impact Papers (CRITICAL)

**Always prioritize influential, highly-cited papers from reputable authors and top venues.** Quality matters more than quantity in literature reviews.

#### Citation Count Thresholds

Use citation counts to identify the most impactful papers:

| Paper Age | Citation Threshold | Classification |
|-----------|-------------------|----------------|
| 0-3 years | 20+ citations | Noteworthy |
| 0-3 years | 100+ citations | Highly Influential |
| 3-7 years | 100+ citations | Significant |
| 3-7 years | 500+ citations | Landmark Paper |
| 7+ years | 500+ citations | Seminal Work |
| 7+ years | 1000+ citations | Foundational |

#### Journal and Venue Tiers

Prioritize papers from higher-tier venues:

- **Tier 1 (Always Prefer):** Nature, Science, Cell, NEJM, Lancet, JAMA, PNAS, Nature Medicine, Nature Biotechnology
- **Tier 2 (Strong Preference):** High-impact specialized journals (IF>10), top conferences (NeurIPS, ICML for ML/AI)
- **Tier 3 (Include When Relevant):** Respected specialized journals (IF 5-10)
- **Tier 4 (Use Sparingly):** Lower-impact peer-reviewed venues

#### Author Reputation Assessment

Prefer papers from:
- **Senior researchers** with high h-index (>40 in established fields)
- **Leading research groups** at recognized institutions (Harvard, Stanford, MIT, Oxford, etc.)
- **Authors with multiple Tier-1 publications** in the relevant field
- **Researchers with recognized expertise** (awards, editorial positions, society fellows)

#### Identifying Seminal Papers

For any topic, identify foundational work by:
1. **High citation count** (typically 500+ for papers 5+ years old)
2. **Frequently cited by other included studies** (appears in many reference lists)
3. **Published in Tier-1 venues** (Nature, Science, Cell family)
4. **Written by field pioneers** (often cited as establishing concepts)

## Best Practices

### Search Strategy
1. **Start with parallel-web**: use `parallel-cli search` with academic domains for initial broad coverage before querying specialized databases
2. **Use multiple databases** (minimum 3): ensures comprehensive coverage (parallel-web counts as one source)
3. **Include preprint servers**: captures latest unpublished findings
4. **Document everything**: search strings, dates, result counts for reproducibility (save all parallel-cli output to `sources/`)
5. **Test and refine**: run pilot searches, review results, adjust search terms
6. **Sort by citations**: when available, sort search results by citation count to surface influential work first
7. **Use parallel-cli extract**: fetch full content from promising URLs found during search to verify relevance before full-text screening

### Screening and Selection
1. **Use clear criteria**: document inclusion/exclusion criteria before screening
2. **Screen systematically**: Title, then Abstract, then Full text
3. **Document exclusions**: record reasons for excluding studies
4. **Consider dual screening**: for systematic reviews, have two reviewers screen independently

### Synthesis
1. **Organize thematically**, not by individual studies
2. **Synthesize across studies**: compare, contrast, identify patterns
3. **Be critical**: evaluate quality and consistency of evidence
4. **Identify gaps**: note what is missing or understudied

### Quality and Reproducibility
1. **Assess study quality** with appropriate quality assessment tools
2. **Verify all citations** with `verify_citations.py`
3. **Document methodology** with enough detail for others to reproduce
4. **Follow guidelines** (PRISMA for systematic reviews)

### Writing
1. Be objective: present evidence fairly, acknowledge limitations
2. Be systematic: follow a structured template
3. Be specific: include numbers, statistics, effect sizes where available
4. Be clear: use clear headings, logical flow, thematic organization

## Common Pitfalls to Avoid

1. Single-database search (always search multiple)
2. No search documentation (makes review irreproducible)
3. Study-by-study summary (lacks synthesis; organize thematically)
4. Unverified citations (always run `verify_citations.py`)
5. Too broad search (refine with specific terms)
6. Too narrow search (include synonyms and related terms)
7. Ignoring preprints (include bioRxiv, medRxiv, arXiv)
8. No quality assessment (assess and report quality)
9. Publication bias (note potential bias)
10. Outdated search (clearly state search date)

## Example Workflow

See [references/example_workflow.md](references/example_workflow.md) for a complete worked example: a biomedical literature review on CRISPR sickle cell disease, walking through template setup, parallel-cli academic and general search, database aggregation, screening, drafting, citation verification, and PDF generation.

## Integration with Other Skills

This skill works seamlessly with other scientific skills:

### Web Search and Extraction (parallel-web skill, PRIMARY)
- **parallel-cli search**: broad academic and general web search with domain filtering. Use for initial scoping, finding papers, citation chaining, and supplementary searches.
- **parallel-cli extract**: fetch full content from paper URLs, journal websites, and preprint servers. Use for reading abstracts, extracting reference lists, and verifying paper details.
- **parallel-cli search --include-domains**: Academic-focused search across scholarly domains (arxiv.org, pubmed, nature.com, etc.)

### Database Access Skills
- **gget**: PubMed, bioRxiv, COSMIC, AlphaFold, Ensembl, UniProt
- **bioservices**: ChEMBL, KEGG, Reactome, UniProt, PubChem
- **datacommons-client**: Demographics, economics, health statistics

### Analysis Skills
- **pydeseq2**: RNA-seq differential expression (for methods sections)
- **scanpy**: Single-cell analysis (for methods sections)
- **anndata**: Single-cell data (for methods sections)
- **biopython**: Sequence analysis (for background sections)

### Visualization Skills
- **matplotlib**: Generate figures and plots for review
- **seaborn**: Statistical visualizations

### Writing Skills
- **brand-guidelines**: Apply institutional branding to PDF
- **internal-comms**: Adapt review for different audiences

## Resources

### Bundled Resources

**Scripts:**
- `scripts/verify_citations.py`: Verify DOIs and generate formatted citations
- `scripts/generate_pdf.py`: Convert markdown to professional PDF
- `scripts/search_databases.py`: Process, deduplicate, and format search results

**References:**
- `references/citation_styles.md`: Detailed citation formatting guide (APA, Nature, Vancouver, Chicago, IEEE)
- `references/database_strategies.md`: Comprehensive database search strategies

**Assets:**
- `assets/review_template.md`: Complete literature review template with all sections

### External Resources

**Guidelines:**
- PRISMA (Systematic Reviews): http://www.prisma-statement.org/
- Cochrane Handbook: https://training.cochrane.org/handbook
- AMSTAR 2 (Review Quality): https://amstar.ca/

**Tools:**
- MeSH Browser: https://meshb.nlm.nih.gov/search
- PubMed Advanced Search: https://pubmed.ncbi.nlm.nih.gov/advanced/
- Boolean Search Guide: https://www.ncbi.nlm.nih.gov/books/NBK3827/

**Citation Styles:**
- APA Style: https://apastyle.apa.org/
- Nature Portfolio: https://www.nature.com/nature-portfolio/editorial-policies/reporting-standards
- NLM/Vancouver: https://www.nlm.nih.gov/bsd/uniform_requirements.html

## Dependencies

See [references/dependencies.md](references/dependencies.md) for the full install commands for `parallel-cli`, required Python packages, pandoc/LaTeX for PDF generation, and the `--check-deps` verification command.

## Summary

This skill provides systematic literature-review methodology with parallel-cli-powered academic search, multi-database integration (gget, bioservices, datacommons-client), citation verification, and markdown/PDF output. The goal is rigorous, reproducible reviews that meet academic standards.

