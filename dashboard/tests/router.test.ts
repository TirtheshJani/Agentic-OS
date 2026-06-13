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

  it("credits a glossary alias as its canonical term (spec 0031, ADR-024)", () => {
    // The only discriminating token shared between an issue and an agent
    // description is the canonical term "session". No other word overlaps, so
    // routing here turns solely on whether the alias collapses to "session".
    const roster: RoutableAgent[] = [
      {
        slug: "session-keeper",
        description: "Owns session bookkeeping.",
        skills: ["ops"],
      },
      {
        slug: "doc-writer",
        description: "Owns paperwork and manuals.",
        skills: ["ops"],
      },
    ];
    const glossary = [
      { term: "session", definition: "An interactive agent run.", aliases: ["run"] },
    ];

    // Canonical term in the issue routes to the agent whose description names it.
    const canonical = routeIssue(
      { title: "Audit the session", body: "" },
      [],
      roster
    );
    expect(canonical.assigneeSlug).toBe("session-keeper");

    // An issue using ONLY the alias "run" routes to the SAME agent once the
    // glossary is supplied, because the alias collapses to its canonical term.
    const aliasOnly = routeIssue(
      { title: "Audit the run", body: "" },
      [],
      roster,
      glossary
    );
    expect(aliasOnly.assigneeSlug).toBe("session-keeper");
    expect(aliasOnly.assigneeSlug).toBe(canonical.assigneeSlug);

    // Without the glossary, "run" is an unknown token that matches no
    // description, so the same alias-only issue routes to no one.
    const noGlossary = routeIssue(
      { title: "Audit the run", body: "" },
      [],
      roster
    );
    expect(noGlossary.assigneeSlug).toBeNull();
  });

  it("leaves routing for non-glossary terms unchanged (regression guard)", () => {
    // A term absent from the supplied glossary must route exactly as the
    // three-argument form does.
    const glossary = [
      { term: "session", definition: "An interactive agent run.", aliases: ["run"] },
    ];
    const withGlossary = routeIssue(
      { title: "Summarize the NIH stance on FHIR-RAG", body: "" },
      [],
      agents,
      glossary
    );
    const withoutGlossary = routeIssue(
      { title: "Summarize the NIH stance on FHIR-RAG", body: "" },
      [],
      agents
    );
    expect(withGlossary.assigneeSlug).toBe("health-watcher");
    expect(withGlossary.assigneeSlug).toBe(withoutGlossary.assigneeSlug);
    expect(withGlossary.reason).toBe(withoutGlossary.reason);
  });
});
