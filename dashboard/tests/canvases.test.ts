import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { resetBusForTesting } from "@/lib/stream";
import { listCanvases, readCanvas, saveCanvas, deleteCanvas, listDesignDocs } from "@/lib/design/canvases";

const SLUG = "studio-proj";
const designDir = path.join(TEST_REPO_ROOT, "vault", "projects", SLUG, "design");

beforeEach(() => {
  openDb(path.join(TEST_REPO_ROOT, `state-canvas-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  resetBusForTesting();
  closeDb();
  fs.rmSync(path.join(TEST_REPO_ROOT, "vault", "projects", SLUG), { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("canvases", () => {
  it("round-trips scene json with svg and md stub", () => {
    const scene = { elements: [{ type: "rectangle" }], appState: {} };
    saveCanvas(SLUG, "system-overview", scene, "<svg>diagram</svg>");
    expect(readCanvas(SLUG, "system-overview")).toEqual(scene);
    expect(fs.readFileSync(path.join(designDir, "system-overview.svg"), "utf8")).toBe("<svg>diagram</svg>");
    const stub = fs.readFileSync(path.join(designDir, "system-overview.md"), "utf8");
    expect(stub).toContain("![](system-overview.svg)");

    const listed = listCanvases(SLUG);
    expect(listed.length).toBe(1);
    expect(listed[0]).toMatchObject({ name: "system-overview", hasSvg: true });
  });

  it("keeps a hand-edited md stub on re-save", () => {
    saveCanvas(SLUG, "c1", { elements: [] }, null);
    fs.writeFileSync(path.join(designDir, "c1.md"), "custom notes");
    saveCanvas(SLUG, "c1", { elements: [1] }, null);
    expect(fs.readFileSync(path.join(designDir, "c1.md"), "utf8")).toBe("custom notes");
  });

  it("separates design docs from canvas stubs", () => {
    saveCanvas(SLUG, "c1", { elements: [] }, null);
    fs.writeFileSync(path.join(designDir, "ARCHITECTURE.md"), "# Arch");
    const docs = listDesignDocs(SLUG);
    expect(docs.map((d) => d.name)).toEqual(["ARCHITECTURE.md"]);
  });

  it("rejects traversal names and unknown slugs", () => {
    expect(() => saveCanvas(SLUG, "../evil", {}, null)).toThrow(/invalid canvas name/);
    expect(() => saveCanvas("Bad Slug", "ok", {}, null)).toThrow(/invalid project slug/);
  });

  it("deletes all three files", () => {
    saveCanvas(SLUG, "c2", { elements: [] }, "<svg/>");
    expect(deleteCanvas(SLUG, "c2")).toBe(true);
    expect(fs.readdirSync(designDir)).toEqual([]);
    expect(deleteCanvas(SLUG, "c2")).toBe(false);
  });
});
