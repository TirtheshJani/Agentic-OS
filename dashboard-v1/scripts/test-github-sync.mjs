#!/usr/bin/env node
// Tests for the phase 8.5 GitHub sync path. Asserts parseGithubRepo (pure
// function) and prints the checkGhAvailable result (env-dependent — not
// asserted). Exits non-zero on any parseGithubRepo failure.
//
// Does NOT exercise importIssues — that one writes to the real db.

import assert from "node:assert/strict";
const sync = await import("../lib/github-sync.ts");

const cases = [
  ["https://github.com/TirtheshJani/FHIR_RAG_TEST", "TirtheshJani/FHIR_RAG_TEST"],
  ["https://github.com/TirtheshJani/FHIR_RAG_TEST.git", "TirtheshJani/FHIR_RAG_TEST"],
  ["https://github.com/TirtheshJani/FHIR_RAG_TEST/", "TirtheshJani/FHIR_RAG_TEST"],
  ["git@github.com:TirtheshJani/FHIR_RAG_TEST.git", "TirtheshJani/FHIR_RAG_TEST"],
  ["github.com/TirtheshJani/FHIR_RAG_TEST", "TirtheshJani/FHIR_RAG_TEST"],
  ["https://gitlab.com/foo/bar", null],
  ["https://github.com/single", null],
  ["not a url", null],
  ["", null],
  [null, null],
  [undefined, null],
];

let failed = 0;
for (const [input, expected] of cases) {
  const actual = sync.parseGithubRepo(input);
  try {
    assert.equal(actual, expected);
    console.log(`OK    parseGithubRepo(${JSON.stringify(input)}) -> ${JSON.stringify(actual)}`);
  } catch {
    failed++;
    console.error(
      `FAIL  parseGithubRepo(${JSON.stringify(input)}) -> ${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`
    );
  }
}

const probe = await sync.checkGhAvailable();
console.log(`\ngh availability: ${JSON.stringify(probe)}`);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nALL PASS");
