// dashboard/lib/issueTemplates.ts
// Templated issue bodies for dashboard-initiated agent work (specs 0019, 0022,
// 0023). Pure functions: the route layer files them via createIssue. Agents
// write vault outputs by ABSOLUTE path because run worktrees live outside the
// repo (precedent: the deep-research skill).

export interface IssueTemplate {
  title: string;
  body: string;
  labels: string[];
}

/**
 * An issue template that also carries epic linkage (spec 0034 / ADR-027): the
 * `epicId` files it under a mission and `dependsOn` (a JSON id array string) wires
 * its dependency edges. The route layer threads these straight into createIssue.
 */
export interface EpicChildTemplate extends IssueTemplate {
  epicId: number;
  dependsOn: string | null;
}

/**
 * Build a child issue under an epic. When `dependsOn` ids are given they are
 * recorded as a JSON array string (the issues.depends_on convention) and a short
 * "Depends on" line is appended to the body so the linkage is visible in the
 * issue text too. Absent dependencies leave the body byte-identical to `base`
 * and `dependsOn` null, so an unlinked template is unaffected.
 */
export function epicChildIssue(opts: {
  epicId: number;
  base: IssueTemplate;
  dependsOn?: number[];
}): EpicChildTemplate {
  const deps = opts.dependsOn ?? [];
  const body = deps.length
    ? `${opts.base.body}\n\nDepends on: ${deps.map((d) => `#${d}`).join(", ")}`
    : opts.base.body;
  return {
    title: opts.base.title,
    body,
    labels: opts.base.labels,
    epicId: opts.epicId,
    dependsOn: deps.length ? JSON.stringify(deps) : null,
  };
}

/**
 * A starter `## Acceptance contract` section (spec 0029). The judge grades each
 * assertion pass/fail and derives correctness from the pass fraction; authors
 * edit or delete these when a task has no gradeable definition of done. The
 * leading blank line spaces the section off in templates that keep blanks; the
 * research template filters blanks, so the heading simply follows the prose.
 */
function acceptanceContract(...assertions: string[]): string[] {
  return ["", "## Acceptance contract", ...assertions.map((a) => `- [ ] ${a}`)];
}

/**
 * An optional `## Why` section (spec 0031, ADR-024) carrying the task intent.
 * `startRun` feeds the whole issue body into the agent context, so a `## Why`
 * line authored here reaches the agent. Empty intent emits nothing, leaving
 * the body byte-identical to a template authored without a why. The leading
 * blank line spaces the section off where blanks are kept; blank-filtering
 * templates drop it and the heading simply follows the prose.
 */
function why(text: string): string[] {
  return text.trim() ? ["", "## Why", text.trim()] : [];
}

export function researchCollectionIssue(opts: {
  slug: string;
  question: string;
  sourceHints?: string;
  vaultDirAbs: string;
}): IssueTemplate {
  const sourcesDir = `${opts.vaultDirAbs}/sources`;
  return {
    title: `Research collection: ${opts.question.slice(0, 70)}`,
    body: [
      `Collect sources for the research project "${opts.slug}".`,
      "",
      `Research question: ${opts.question}`,
      opts.sourceHints ? `Source hints from the operator: ${opts.sourceHints}` : "",
      "",
      "Instructions:",
      `1. Use the deep-research / research-lookup skills to find relevant, high-quality sources.`,
      `2. Write EACH source as one markdown file in ${sourcesDir}/ (create the folder if needed) named <kebab-slug>.md with this frontmatter contract:`,
      "   ---",
      "   source-url: <url>",
      "   source-type: web | youtube | reddit | paper",
      "   collected-by: <your agent slug>",
      "   collected-at: <YYYY-MM-DD>",
      "   ---",
      "   followed by a faithful summary plus the key extracts (quote sparingly, attribute clearly).",
      `3. When done, update ${opts.vaultDirAbs}/RESEARCH.md: set status: active in the frontmatter and append a one-paragraph collection log.`,
      "",
      "Do not modify anything outside that vault folder.",
      ...acceptanceContract(
        `At least 3 source files exist in ${sourcesDir}/ with valid frontmatter.`,
        `${opts.vaultDirAbs}/RESEARCH.md has status: active and a one-paragraph collection log.`,
      ),
    ]
      .filter((l) => l !== "")
      .join("\n"),
    labels: ["research", `research:${opts.slug}`],
  };
}

export function learningSessionIssue(opts: {
  topic: string;
  tutorSlug: string;
  syllabusExcerpt: string;
  vaultDirAbs: string;
  kind: "tutor" | "srs-review";
}): IssueTemplate {
  const isSrs = opts.kind === "srs-review";
  return {
    title: isSrs ? `SRS review: ${opts.topic}` : `Tutoring session: ${opts.topic}`,
    body: [
      isSrs
        ? `Run a spaced-repetition review session for the topic "${opts.topic}". Quiz the operator from ${opts.vaultDirAbs}/srs.md, one question at a time, waiting for their answer before revealing yours. Update last-reviewed dates as you go.`
        : `Run an interactive tutoring session for the topic "${opts.topic}". The operator is at the terminal: teach by eliciting their reasoning before explaining (Socratic style), one concept at a time.`,
      "",
      "Syllabus context:",
      opts.syllabusExcerpt || "(no syllabus yet — start by agreeing one with the operator)",
      "",
      `End the session by appending a session log to ${opts.vaultDirAbs}/sessions/<YYYY-MM-DD>.md (create folders as needed): what was covered, what the operator struggled with, and what to review next. Update the syllabus checklist in ${opts.vaultDirAbs}/SYLLABUS.md if goals were completed.`,
      "",
      "The worktree you are in is scratch space for exercises; nothing in it is kept.",
      ...acceptanceContract(
        isSrs
          ? `Last-reviewed dates were updated in ${opts.vaultDirAbs}/srs.md for the items quizzed.`
          : `A session log was appended to ${opts.vaultDirAbs}/sessions/<YYYY-MM-DD>.md covering what was taught.`,
      ),
    ].join("\n"),
    labels: ["learning", `learning:${opts.topic}`],
  };
}

export function designReviewIssue(opts: {
  slug: string;
  designDirAbs: string;
  canvasNames: string[];
  why?: string;
}): IssueTemplate {
  return {
    title: `Design review: ${opts.slug}`,
    body: [
      `Review this project's architecture design docs and diagrams.`,
      "",
      `1. Read ${opts.designDirAbs}/ARCHITECTURE.md (and any DESIGN-*.md) if present.`,
      opts.canvasNames.length > 0
        ? `2. Read the exported diagram SVGs: ${opts.canvasNames.map((n) => `${opts.designDirAbs}/${n}.svg`).join(", ")} — they are XML text; shape labels carry the design.`
        : "2. No canvases exported yet; review the docs and the repository structure.",
      `3. Compare the documented design against the actual code in this worktree: name mismatches, risks, missing pieces, and simplifications.`,
      `4. Write your findings to ${opts.designDirAbs}/REVIEW-<YYYY-MM-DD>.md: verdict summary, findings ordered by severity, concrete recommendations.`,
      "",
      "Do not change code in this run; it is a review.",
      ...acceptanceContract(
        `${opts.designDirAbs}/REVIEW-<YYYY-MM-DD>.md was written with a verdict, findings ordered by severity, and recommendations.`,
      ),
      ...why(opts.why ?? ""),
    ].join("\n"),
    labels: ["design-review"],
  };
}
