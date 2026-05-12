# Install cc-notify (Windows desktop notifications)

One-time setup for Windows toast notifications when long Claude Code runs finish in the background. Companion to the `Stop` hook in `.claude/settings.json`.

## Why

The dashboard's observability layer covers runs Claude initiates from within the dashboard UI. Native toasts cover everything else: terminal sessions, scheduled remote agents whose results land while you're in another window, long builds.

The `dazuiba/CCNotify` listed under "hooks/notifications" in `awesome-claude-code` is macOS-only (depends on `terminal-notifier`). For Windows 11, use `lustresixx/cc-notify`, which ships as a single Go binary using native Windows toast APIs.

## Source

- Repo: https://github.com/lustresixx/cc-notify
- License: MIT
- Runtime deps: none. Pure Go binary.

## Install

### Option A: prebuilt release (recommended)

1. Download the latest `cc-notify_windows_amd64.zip` from https://github.com/lustresixx/cc-notify/releases
2. Extract anywhere (e.g., `C:\Users\TJ\Tools\cc-notify\`)
3. Run `install.cmd` (double-click or invoke from PowerShell)

The installer:
- Writes the binary path into `~/.claude/settings.json` under `hooks.Stop`
- Creates the binary's own config file (`%APPDATA%\cc-notify\config.json`)

### Option B: build from source

Requires Go 1.21+.

```powershell
git clone https://github.com/lustresixx/cc-notify
cd cc-notify
go build -o dist/cc-notify.exe ./cmd/cc-notify
.\dist\cc-notify.exe install
```

## Verify

```powershell
# Confirm hook is registered
Get-Content "$HOME\.claude\settings.json" | Select-String "cc-notify"

# Manual trigger
cc-notify.exe test
```

A toast should appear within a few seconds. If nothing fires, check:
- Windows Focus Assist is not blocking notifications
- The binary path in `settings.json` is correct and absolute
- `cc-notify.exe doctor` reports no missing config

## Configure

`cc-notify` writes its own config at `%APPDATA%\cc-notify\config.json`. Editable fields:

```json
{
  "enabled": true,
  "claude_mode": "toast",        // "toast" or "popup"
  "claude_content": "summary"     // "full" or "summary"
}
```

Use `popup` mode for blocking confirmation dialogs (useful for unattended scheduled runs you want to gate on attention).

## Uninstall

```powershell
cc-notify.exe uninstall
```

Removes the hook block from `settings.json` and the local config.

## Settings.json snippet (what the installer writes)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "C:\\Users\\TJ\\Tools\\cc-notify\\cc-notify.exe Stop" }
        ]
      }
    ]
  }
}
```

You can layer additional `Stop` hooks alongside it (e.g., a logger). The harness runs all entries in order.

## Why not the johnlindquist/claude-hooks framework

That framework is TypeScript-first and powerful, but it's a foundation for *authoring* custom hooks rather than a drop-in notifier. For toast-on-stop, `cc-notify` is the right scope.

## Related

- `update-config` skill: use it for any other `settings.json` hook changes
- `automations/remote/`: scheduled agents that benefit most from toast-on-completion
