import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import path from "node:path";
import { resetSettingsForTesting, setSettings } from "@/lib/settings";
import {
  setDockerExecForTesting,
  dockerAvailable,
  listStacks,
  listContainers,
  stackAction,
  assertAllowlisted,
  containerLogs,
} from "@/lib/docker";

let calls: string[][] = [];
let responses: Record<string, { ok: boolean; stdout: string; stderr: string }> = {};

function fakeExec(args: string[]) {
  calls.push(args);
  const key = args.join(" ");
  return responses[key] ?? { ok: false, stdout: "", stderr: `no fake for: ${key}` };
}

beforeEach(() => {
  calls = [];
  responses = {};
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, `.agentic-os-docker-${Date.now()}-${Math.random()}`);
  resetSettingsForTesting();
  setDockerExecForTesting(fakeExec);
});

afterEach(() => {
  setDockerExecForTesting(null);
  resetSettingsForTesting();
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("dockerAvailable", () => {
  it("splits binary-present from daemon-reachable", () => {
    responses["--version"] = { ok: true, stdout: "Docker version 29.4.1, build x", stderr: "" };
    responses["info --format {{json .ServerVersion}}"] = {
      ok: false,
      stdout: "",
      stderr: "failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine",
    };
    expect(dockerAvailable()).toEqual({ cli: true, daemon: false, version: "29.4.1" });

    responses["info --format {{json .ServerVersion}}"] = { ok: true, stdout: '"29.4.1"', stderr: "" };
    expect(dockerAvailable().daemon).toBe(true);
  });
});

describe("listing", () => {
  it("parses compose ls JSON arrays", () => {
    responses["compose ls --all --format json"] = {
      ok: true,
      stdout: '[{"Name":"lightrag","Status":"running(2)","ConfigFiles":"C:\\\\x\\\\docker-compose.yml"}]',
      stderr: "",
    };
    expect(listStacks()).toEqual([{ name: "lightrag", status: "running(2)", configFiles: "C:\\x\\docker-compose.yml" }]);
  });

  it("parses docker ps NDJSON and extracts compose project labels", () => {
    responses["ps --all --format json"] = {
      ok: true,
      stdout:
        '{"ID":"abc123","Names":"lightrag-api","Image":"lightrag:latest","State":"running","Status":"Up 2 hours","Labels":"com.docker.compose.project=lightrag,other=x","Ports":"9621/tcp"}\n' +
        '{"ID":"def456","Names":"adhoc","Image":"redis","State":"exited","Status":"Exited","Labels":"","Ports":""}',
      stderr: "",
    };
    const containers = listContainers();
    expect(containers.length).toBe(2);
    expect(containers[0].composeProject).toBe("lightrag");
    expect(containers[1].composeProject).toBeNull();
  });

  it("falls back to the {{json .}} format when plain json is rejected", () => {
    responses["ps --all --format json"] = { ok: false, stdout: "", stderr: "unknown flag" };
    responses["ps --all --format {{json .}}"] = {
      ok: true,
      stdout: '{"ID":"abc","Names":"n","Image":"i","State":"running","Status":"Up","Labels":"","Ports":""}',
      stderr: "",
    };
    expect(listContainers().length).toBe(1);
  });
});

describe("allowlist gating", () => {
  it("rejects non-allowlisted and invalid project names", () => {
    setSettings({ docker: { enabled: true, allowlist: ["lightrag"] } });
    expect(() => assertAllowlisted("otherstack")).toThrow(/not on the allowlist/);
    expect(() => assertAllowlisted("bad name; rm -rf")).toThrow(/invalid compose project/);
    expect(() => assertAllowlisted("lightrag")).not.toThrow();
  });

  it("runs compose actions only for allowlisted projects", () => {
    setSettings({ docker: { enabled: true, allowlist: ["lightrag"] } });
    responses["compose -p lightrag restart"] = { ok: true, stdout: "restarted", stderr: "" };
    expect(stackAction("restart", "lightrag")).toEqual({ ok: true, output: "restarted" });
    expect(() => stackAction("stop", "evil")).toThrow();
  });
});

describe("containerLogs", () => {
  it("strips ANSI and validates the id", () => {
    responses["logs --tail 400 abc123"] = { ok: true, stdout: "[32mok[0m line", stderr: "" };
    expect(containerLogs("abc123")).toBe("ok line");
    expect(() => containerLogs("../etc")).toThrow(/invalid container id/);
  });
});
