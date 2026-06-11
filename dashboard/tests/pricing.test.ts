import { describe, it, expect } from "vitest";
import { priceFor, estimateCost } from "@/lib/usage/pricing";

describe("priceFor", () => {
  it("matches by longest prefix", () => {
    expect(priceFor("claude-opus-4-8")?.inPerMTok).toBe(5);
    expect(priceFor("claude-sonnet-4-6")?.inPerMTok).toBe(3);
    expect(priceFor("claude-haiku-4-5-20251001")?.inPerMTok).toBe(1);
    expect(priceFor("claude-fable-5[1m]")?.inPerMTok).toBe(10);
  });

  it("returns null for unknown models", () => {
    expect(priceFor("gpt-4o")).toBeNull();
    expect(priceFor("gemini-2.5-pro")).toBeNull();
  });
});

describe("estimateCost", () => {
  it("sums across models", () => {
    const cost = estimateCost({
      "claude-opus-4-8": { in: 1_000_000, out: 1_000_000, cacheWrite: 0, cacheRead: 0, turns: 2 },
    });
    expect(cost).toBeCloseTo(30); // 5 in + 25 out
  });

  it("returns null when any model is unpriced and for empty maps", () => {
    expect(
      estimateCost({
        "claude-opus-4-8": { in: 1, out: 1, cacheWrite: 0, cacheRead: 0, turns: 1 },
        "mystery-model": { in: 1, out: 1, cacheWrite: 0, cacheRead: 0, turns: 1 },
      })
    ).toBeNull();
    expect(estimateCost({})).toBeNull();
  });
});
