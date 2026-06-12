import { describe, it, expect, beforeEach } from "vitest";
import { registerRuntime, getRuntime, listRuntimes, resetRegistryForTesting } from "@/lib/runtime/registry";
import type { Runtime } from "@/lib/runtime/types";

const fakeRuntime: Runtime = {
  id: "fake",
  displayName: "Fake CLI",
  capabilities: {
    sessionResume: true,
    sessionIdCapture: true,
    hooks: true,
    transcriptCostParsing: false,
    externalTerminalEscape: true,
  },
  detect: async () => ({ available: true, version: "1.0" }),
  spawn: async () => { throw new Error("not used in registry test"); },
  formatResumeCommand: (sid) => `fake --resume ${sid}`,
};

beforeEach(() => resetRegistryForTesting());

describe("runtime registry", () => {
  it("registers and retrieves a runtime by id", () => {
    registerRuntime(fakeRuntime);
    expect(getRuntime("fake")?.displayName).toBe("Fake CLI");
  });

  it("returns null for unknown ids", () => {
    expect(getRuntime("nope")).toBeNull();
  });

  it("lists registered runtimes", () => {
    registerRuntime(fakeRuntime);
    registerRuntime({ ...fakeRuntime, id: "other" });
    expect(listRuntimes().map(r => r.id).sort()).toEqual(["fake", "other"]);
  });

  it("registering same id twice overwrites", () => {
    registerRuntime(fakeRuntime);
    registerRuntime({ ...fakeRuntime, displayName: "Updated" });
    expect(getRuntime("fake")?.displayName).toBe("Updated");
  });
});
