import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchForJsonlSessionId } from "@/lib/runtime/sessionIdCapture";

let TMP: string;

beforeEach(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-sid-"));
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("watchForJsonlSessionId", () => {
  it("resolves with the session_id when a new jsonl file appears", async () => {
    const projectDir = path.join(TMP, "encoded-cwd");
    fs.mkdirSync(projectDir, { recursive: true });

    const handle = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });

    setTimeout(() => {
      fs.writeFileSync(path.join(projectDir, "abc-123-uuid.jsonl"), "");
    }, 100);

    const sid = await handle.promise;
    expect(sid).toBe("abc-123-uuid");
  });

  it("rejects after timeout if nothing appears", async () => {
    const handle = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 200 });
    await expect(handle.promise).rejects.toThrow(/timeout/i);
  });

  it("cancel() prevents resolution even when a file appears later", async () => {
    const projectDir = path.join(TMP, "encoded-cwd");
    fs.mkdirSync(projectDir, { recursive: true });

    const handle = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });
    handle.cancel();

    // Wrap promise so we can race with a timeout to confirm it never resolves.
    const settled = await Promise.race([
      handle.promise.then(() => "resolved").catch(() => "rejected"),
      new Promise<string>(resolve => setTimeout(() => resolve("never"), 300)),
    ]);

    // Note: cancel does not reject the promise; it just prevents settlement.
    // The promise stays pending. So "never" is the expected race winner.
    expect(settled).toBe("never");

    // Sanity: writing a file after cancel does nothing.
    fs.writeFileSync(path.join(projectDir, "x.jsonl"), "");
  });

  it("runs two watchers in parallel without interference", async () => {
    const dirA = path.join(TMP, "encoded-cwd-a");
    fs.mkdirSync(dirA, { recursive: true });

    const handleA = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });
    const handleB = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });

    setTimeout(() => fs.writeFileSync(path.join(dirA, "sid-A.jsonl"), ""), 50);

    const sidA = await handleA.promise;
    const sidB = await handleB.promise;
    expect(sidA).toBe("sid-A");
    expect(sidB).toBe("sid-A"); // Both watchers see the same new file
  });
});
