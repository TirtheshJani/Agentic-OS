import { describe, it, expect, beforeEach } from "vitest";
import { publish, subscribe, resetBusForTesting } from "@/lib/stream";

beforeEach(() => resetBusForTesting());

describe("stream bus", () => {
  it("delivers events to a single subscriber", () => {
    const received: any[] = [];
    const unsub = subscribe(e => received.push(e));
    publish({ kind: "project.changed", slug: "x", reason: "update" });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ kind: "project.changed", slug: "x" });
    unsub();
  });

  it("delivers to multiple subscribers", () => {
    const a: any[] = [];
    const b: any[] = [];
    subscribe(e => a.push(e));
    subscribe(e => b.push(e));
    publish({ kind: "agent.changed", slug: "x", reason: "update" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("stops delivering after unsubscribe", () => {
    const received: any[] = [];
    const unsub = subscribe(e => received.push(e));
    unsub();
    publish({ kind: "project.changed", slug: "x", reason: "update" });
    expect(received).toHaveLength(0);
  });
});
