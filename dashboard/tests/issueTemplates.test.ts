import { describe, it, expect } from "vitest";
import { researchCollectionIssue, learningSessionIssue, designReviewIssue } from "@/lib/issueTemplates";

describe("researchCollectionIssue", () => {
  it("embeds the absolute vault path, the frontmatter contract, and labels", () => {
    const t = researchCollectionIssue({
      slug: "qml-dx",
      question: "Can QML help diagnostics?",
      sourceHints: "start with arXiv",
      vaultDirAbs: "C:/repo/vault/research/qml-dx",
    });
    expect(t.title).toContain("Research collection");
    expect(t.body).toContain("C:/repo/vault/research/qml-dx/sources/");
    expect(t.body).toContain("source-url:");
    expect(t.body).toContain("start with arXiv");
    expect(t.body).toContain("RESEARCH.md");
    expect(t.labels).toEqual(["research", "research:qml-dx"]);
  });
});

describe("learningSessionIssue", () => {
  it("builds tutor and srs variants with the session-log contract", () => {
    const base = {
      topic: "linear-algebra",
      tutorSlug: "socratic-tutor",
      syllabusExcerpt: "- [ ] eigenvalues",
      vaultDirAbs: "C:/repo/vault/learning/linear-algebra",
    };
    const tutor = learningSessionIssue({ ...base, kind: "tutor" });
    expect(tutor.title).toContain("Tutoring session");
    expect(tutor.body).toContain("Socratic");
    expect(tutor.body).toContain("C:/repo/vault/learning/linear-algebra/sessions/");
    expect(tutor.labels).toContain("learning:linear-algebra");

    const srs = learningSessionIssue({ ...base, kind: "srs-review" });
    expect(srs.title).toContain("SRS review");
    expect(srs.body).toContain("srs.md");
  });
});

describe("designReviewIssue", () => {
  it("references docs, canvases, and the review output path", () => {
    const t = designReviewIssue({
      slug: "my-app",
      designDirAbs: "C:/repo/vault/projects/my-app/design",
      canvasNames: ["system-overview"],
    });
    expect(t.body).toContain("ARCHITECTURE.md");
    expect(t.body).toContain("system-overview.svg");
    expect(t.body).toContain("REVIEW-<YYYY-MM-DD>.md");
    expect(t.labels).toEqual(["design-review"]);

    const noCanvas = designReviewIssue({ slug: "x", designDirAbs: "/v/d", canvasNames: [] });
    expect(noCanvas.body).toContain("No canvases exported yet");
  });
});
