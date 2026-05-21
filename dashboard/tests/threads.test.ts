import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  appendComment,
  appendEvent,
  readThread,
  threadFilePath,
} from "@/lib/threads";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-threads-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("threads", () => {
  it("threadFilePath builds the canonical path", () => {
    const p = threadFilePath("qml", 12, tmp);
    expect(p).toBe(path.join(tmp, "qml", "threads", "12.md"));
  });

  it("appendComment creates the file and writes a section", () => {
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "Hello world" }, tmp);
    const content = fs.readFileSync(threadFilePath("qml", 1, tmp), "utf8");
    expect(content).toContain("Hello world");
    expect(content).toContain("(comment from operator)");
  });

  it("appendComment appends without overwriting", () => {
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "First" }, tmp);
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "Second" }, tmp);
    const content = fs.readFileSync(threadFilePath("qml", 1, tmp), "utf8");
    expect(content).toContain("First");
    expect(content).toContain("Second");
  });

  it("appendEvent records a structured event", () => {
    appendEvent({ projectSlug: "qml", issueId: 1, eventType: "status.changed", details: "backlog to queued" }, tmp);
    const content = fs.readFileSync(threadFilePath("qml", 1, tmp), "utf8");
    expect(content).toContain("(event: status.changed)");
    expect(content).toContain("backlog to queued");
  });

  it("readThread returns parsed entries in order", () => {
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "A" }, tmp);
    appendEvent({ projectSlug: "qml", issueId: 1, eventType: "x", details: "y" }, tmp);
    appendComment({ projectSlug: "qml", issueId: 1, author: "operator", text: "B" }, tmp);
    const entries = readThread("qml", 1, tmp);
    expect(entries).toHaveLength(3);
    expect(entries[0].kind).toBe("comment");
    expect(entries[1].kind).toBe("event");
    expect(entries[2].kind).toBe("comment");
    expect(entries[0].body).toBe("A");
  });

  it("readThread returns empty when the file does not exist", () => {
    expect(readThread("qml", 999, tmp)).toEqual([]);
  });
});
