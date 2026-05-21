import fs from "node:fs";
import path from "node:path";

interface InstallOpts {
  worktreePath: string;
  hookScriptPath: string;
  callbackUrl: string;
  runId: number;
}

export function installSessionStartHook(opts: InstallOpts): void {
  const settingsDir = path.join(opts.worktreePath, ".claude");
  const settingsPath = path.join(settingsDir, "settings.local.json");
  fs.mkdirSync(settingsDir, { recursive: true });

  let current: any = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      current = {};
    }
  }

  // The command wraps the node script with the env vars the script reads.
  // The command runs the hook script with callback URL and run ID as positional
  // args. Quoting both the script path and the URL handles spaces in paths. We
  // pass these as args rather than env-var prefix (VAR=value node ...) because
  // env-prefix syntax is bash-only and breaks under cmd.exe on Windows native.
  const command = `node "${opts.hookScriptPath}" "${opts.callbackUrl}" ${opts.runId}`;

  current.hooks = current.hooks ?? {};
  current.hooks.SessionStart = [
    {
      hooks: [{ type: "command", command }],
    },
  ];

  fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2));
}
