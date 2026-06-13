import { describe, it, expect, beforeEach } from "vitest";
import {
  registerRuntime,
  getRuntime,
  listRuntimes,
  resetRegistryForTesting,
  firstAvailableRuntime,
  resolveRuntime,
} from "@/lib/runtime/registry";
import type { Runtime, RuntimeAvailability } from "@/lib/runtime/types";

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

/** Build a fake runtime with a given id and availability behavior. */
function rt(id: string, detect: () => Promise<RuntimeAvailability>): Runtime {
  return { ...fakeRuntime, id, detect };
}
const avail = (id: string) => rt(id, async () => ({ available: true, version: "1.0" }));
const down = (id: string) => rt(id, async () => ({ available: false, version: null, error: "not on PATH" }));
const throws = (id: string) => rt(id, async () => { throw new Error("detect crashed"); });

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

describe("firstAvailableRuntime (LLM-routing fallback)", () => {
  it("returns the first available runtime in registration order", async () => {
    registerRuntime(avail("a"));
    registerRuntime(avail("b"));
    expect((await firstAvailableRuntime())?.id).toBe("a");
  });

  it("skips excluded ids", async () => {
    registerRuntime(avail("a"));
    registerRuntime(avail("b"));
    expect((await firstAvailableRuntime(["a"]))?.id).toBe("b");
  });

  it("skips unavailable runtimes and detection failures", async () => {
    registerRuntime(down("a"));
    registerRuntime(throws("b"));
    registerRuntime(avail("c"));
    expect((await firstAvailableRuntime())?.id).toBe("c");
  });

  it("returns null when nothing is available", async () => {
    registerRuntime(down("a"));
    registerRuntime(throws("b"));
    expect(await firstAvailableRuntime()).toBeNull();
  });
});

describe("resolveRuntime (LLM-routing fallback)", () => {
  it("disabled: uses the requested runtime verbatim without probing availability", async () => {
    let detected = false;
    registerRuntime(rt("primary", async () => { detected = true; return { available: true, version: "1" }; }));
    const res = await resolveRuntime("primary", false);
    expect(res).toMatchObject({ runtimeId: "primary", fellBack: false });
    expect(detected).toBe(false); // no detect() call when the flag is off
  });

  it("disabled: returns null for an unregistered runtime", async () => {
    expect(await resolveRuntime("nope", false)).toBeNull();
  });

  it("enabled: keeps an available primary (no fallback)", async () => {
    registerRuntime(avail("primary"));
    registerRuntime(avail("secondary"));
    const res = await resolveRuntime("primary", true);
    expect(res).toMatchObject({ runtimeId: "primary", fellBack: false });
  });

  it("enabled: routes an unavailable primary to an available secondary", async () => {
    registerRuntime(down("primary"));
    registerRuntime(avail("secondary"));
    const res = await resolveRuntime("primary", true);
    expect(res).toMatchObject({ runtimeId: "secondary", fellBack: true });
  });

  it("enabled: routes an unregistered primary to an available runtime", async () => {
    registerRuntime(avail("secondary"));
    const res = await resolveRuntime("ghost", true);
    expect(res).toMatchObject({ runtimeId: "secondary", fellBack: true });
  });

  it("enabled: falls back to the registered primary when nothing is available", async () => {
    registerRuntime(down("primary"));
    const res = await resolveRuntime("primary", true);
    expect(res).toMatchObject({ runtimeId: "primary", fellBack: false });
  });

  it("enabled: returns null when nothing is registered", async () => {
    expect(await resolveRuntime("primary", true)).toBeNull();
  });
});
