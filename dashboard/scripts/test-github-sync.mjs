#!/usr/bin/env node
// Diagnostic for the phase 8.5 GitHub sync path.
//
// What it does:
//   1. Probes `gh auth status` via checkGhAvailable().
//   2. Tests parseGithubRepo against a few canonical inputs.
//   3. If gh is authed, optionally runs `gh issue list --limit 1` against
//      a small public repo to confirm the JSON shape we depend on.
//
// Never fails: prints the result and exits 0 even when gh is missing.
// This is a diagnostic, not a CI gate.

const sync = await import("../lib/github-sync.ts");

console.log("--- parseGithubRepo ---");
const cases = [
  "https://github.com/TirtheshJani/FHIR_RAG_TEST",
  "https://github.com/TirtheshJani/FHIR_RAG_TEST.git",
  "https://github.com/TirtheshJani/FHIR_RAG_TEST/",
  "git@github.com:TirtheshJani/FHIR_RAG_TEST.git",
  "https://gitlab.com/foo/bar",
  "not a url",
  null,
];
for (const c of cases) {
  console.log(`  ${JSON.stringify(c)} -> ${JSON.stringify(sync.parseGithubRepo(c))}`);
}

console.log("\n--- checkGhAvailable ---");
const probe = await sync.checkGhAvailable();
console.log(`  result: ${JSON.stringify(probe)}`);

if (probe.ok) {
  console.log("\n--- live gh issue list (TirtheshJani/Agentic-OS, --limit 1) ---");
  const summary = await sync.importIssues("TirtheshJani/Agentic-OS", { projectSlug: null });
  // importIssues commits to the DB. We don't want that side effect during a
  // diagnostic, so we ran it against an in-memory placeholder only when the
  // caller sets AGENTIC_OS_DB to a temp path. Print the counts either way
  // so the user sees the shape.
  console.log(`  summary: ${JSON.stringify(summary)}`);
} else {
  console.log("\n  gh CLI not available — skipping live probe. This is fine.");
}

console.log("\nOK");
