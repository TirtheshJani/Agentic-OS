import { describe, it, expect } from "vitest";
import { routeIssue, type RoutableAgent } from "@/lib/orchestrator/router";

const agents: RoutableAgent[] = [
  {
    slug: "health-watcher",
    description: "Tracks FDA, NIH, FHIR, HIPAA and healthcare policy news.",
    skills: ["healthcare-research", "pubmed-digest"],
  },
  {
    slug: "arxiv-watcher",
    description: "Watches arxiv machine learning and astrophysics papers.",
    skills: ["paper-search", "literature-review"],
  },
  {
    slug: "research-lead",
    description: "Routes research tasks to the right teammate.",
    skills: ["research"],
  },
];

describe("routeIssue", () => {
  it("routes by description keywords (ADR-007)", () => {
    const r = routeIssue(
      { title: "Summarize the NIH stance on FHIR-RAG", body: "" },
      [],
      agents
    );
    expect(r.assigneeSlug).toBe("health-watcher");
    expect(r.reason).toContain("nih");
  });

  it("a skill-free prompt routes to the member with domain vocabulary (spec 0028)", () => {
    // Two members share the same skill tag; only the enriched description names
    // the domain. A prompt that mentions no skill must route on description.
    const roster: RoutableAgent[] = [
      {
        slug: "data-scientist",
        description: "Builds classification and regression models, feature engineering, scikit-learn pipelines.",
        skills: ["research"],
      },
      { slug: "generalist", description: "Handles miscellaneous research work.", skills: ["research"] },
    ];
    const r = routeIssue(
      { title: "Build a classification model with feature engineering", body: "" },
      [],
      roster
    );
    expect(r.assigneeSlug).toBe("data-scientist");
  });

  it("routes by skill-name match when descriptions are silent", () => {
    const r = routeIssue(
      { title: "Run a literature-review on diffusion models", body: "" },
      [],
      agents
    );
    expect(r.assigneeSlug).toBe("arxiv-watcher");
  });

  it("never routes to a lead agent", () => {
    const r = routeIssue(
      { title: "research teammate routes tasks", body: "" },
      [],
      [agents[2]]
    );
    expect(r.assigneeSlug).toBeNull();
  });

  it("respects project capability eligibility", () => {
    const r = routeIssue(
      { title: "Summarize the NIH stance on FHIR", body: "" },
      ["paper-search"],
      agents
    );
    // health-watcher is ineligible (no capability overlap); arxiv-watcher
    // matches nothing in the text, so the issue holds.
    expect(r.assigneeSlug).toBeNull();
  });

  it("returns null with a reason when nothing matches", () => {
    const r = routeIssue({ title: "zzz qqq", body: "" }, [], agents);
    expect(r.assigneeSlug).toBeNull();
    expect(r.reason).toBeTruthy();
  });
});
