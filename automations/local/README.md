# Local automations

Shell scripts you invoke when the laptop is open. **No cron, no
launchd** — see `product/decisions.md` ADR-002.

Each script is a thin wrapper around `claude -p` for a single skill. See
`standards/automation-authoring.md` for the contract.

## Run

```bash
./automations/local/morning-scan.sh
```

## Add one

See `instructions/add-automation.md`. One file per (skill, cadence).
