import { describe, it, expect } from "vitest";
import { resolveLaunch } from "@/lib/runtime/launch";

describe("resolveLaunch", () => {
  it("passes a bare command through unchanged on posix", () => {
    expect(resolveLaunch({ bin: "claude", args: ["--x", "y"], platform: "linux" })).toEqual({
      file: "claude",
      args: ["--x", "y"],
    });
    expect(resolveLaunch({ bin: "gemini", args: [], platform: "darwin" })).toEqual({
      file: "gemini",
      args: [],
    });
  });

  it("passes a posix .cmd-looking name through on posix (no cmd.exe off Windows)", () => {
    // The extension only triggers the wrapper on win32.
    expect(resolveLaunch({ bin: "weird.cmd", args: ["a"], platform: "linux" })).toEqual({
      file: "weird.cmd",
      args: ["a"],
    });
  });

  it("wraps a .cmd shim in cmd.exe /c on win32 (CreateProcess cannot exec .cmd)", () => {
    const r = resolveLaunch({
      bin: "claude.cmd",
      args: ["--dangerously-skip-permissions", "--model", "opus"],
      platform: "win32",
    });
    expect(r.file.toLowerCase().endsWith("cmd.exe")).toBe(true);
    expect(r.args).toEqual(["/c", "claude.cmd", "--dangerously-skip-permissions", "--model", "opus"]);
  });

  it("wraps a .bat shim in cmd.exe /c on win32", () => {
    const r = resolveLaunch({ bin: "tool.bat", args: ["x"], platform: "win32" });
    expect(r.file.toLowerCase().endsWith("cmd.exe")).toBe(true);
    expect(r.args).toEqual(["/c", "tool.bat", "x"]);
  });

  it("wraps a bare command (no extension) on win32 — cmd.exe resolves the shim via PATHEXT", () => {
    // npm installs `claude` as `claude.cmd`; `cmd.exe /c claude` finds it.
    expect(resolveLaunch({ bin: "claude", args: ["--v"], platform: "win32" }).args).toEqual([
      "/c",
      "claude",
      "--v",
    ]);
  });

  it("launches a real .exe directly on win32 (no cmd.exe wrapper)", () => {
    expect(resolveLaunch({ bin: "agy.exe", args: ["--prompt-interactive", "hi"], platform: "win32" })).toEqual({
      file: "agy.exe",
      args: ["--prompt-interactive", "hi"],
    });
  });

  it("launches an absolute .exe path directly on win32", () => {
    const abs = "C:\\Users\\me\\AppData\\Local\\agy\\bin\\agy.exe";
    expect(resolveLaunch({ bin: abs, args: ["x"], platform: "win32" })).toEqual({ file: abs, args: ["x"] });
  });

  it("treats the extension case-insensitively on win32", () => {
    expect(resolveLaunch({ bin: "agy.EXE", args: [], platform: "win32" }).file).toBe("agy.EXE");
    expect(resolveLaunch({ bin: "thing.CMD", args: ["a"], platform: "win32" }).args).toEqual([
      "/c",
      "thing.CMD",
      "a",
    ]);
  });

  it("does not mutate the caller's args array", () => {
    const args = ["--a", "--b"];
    resolveLaunch({ bin: "x.cmd", args, platform: "win32" });
    expect(args).toEqual(["--a", "--b"]);
  });

  it("honors the ComSpec env var for the shell path on win32", () => {
    const prev = process.env.ComSpec;
    process.env.ComSpec = "D:\\custom\\cmd.exe";
    try {
      expect(resolveLaunch({ bin: "x.cmd", args: [], platform: "win32" }).file).toBe("D:\\custom\\cmd.exe");
    } finally {
      if (prev === undefined) delete process.env.ComSpec;
      else process.env.ComSpec = prev;
    }
  });
});
