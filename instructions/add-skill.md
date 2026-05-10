# Add a skill

When asked to author a new skill in this repo:

1. **Read `standards/skill-authoring.md` first.** Don't skip — it codifies
   the official Anthropic spec plus our local `metadata` convention.
2. **Delegate to `skills/_meta/skill-creator`.** From a Claude Code
   session in this repo, run `/new-skill`. The slash command loads
   Anthropic's production skill-creator with this repo's context.
   - Do **not** re-implement the skill-creator workflow inline.
3. **Pick a folder.** `skills/<domain>/<name>/` where domain matches one of
   the directories already on disk. New top-level domains are a
   `product/decisions.md` ADR-worthy event.
4. **Write the SKILL.md** following the spec (see standard).
   - Frontmatter: only `name`, `description`, `license`, `allowed-tools`,
     `metadata`.
   - `metadata.status: stub` until you've smoke-tested the body.
5. **Add helpers as needed.**
   - Long reference docs → `references/<topic>.md`.
   - Deterministic checks → `scripts/<name>.{py,sh,mjs}`.
   - Templates → `assets/<name>.<ext>`.
   - **Never** add a `README.md` inside the skill folder.
6. **Run the validator.**
   ```bash
   node dashboard/scripts/validate-skills.mjs
   ```
   Must exit 0.
7. **Smoke test.** Run the skill via the dashboard or
   `claude -p "Use the <name> skill"`. Verify outputs land at the paths
   declared in `metadata.outputs`. Flip `metadata.status` to `authored`.
8. **No registration step.** The dashboard auto-discovers via filesystem
   walk on startup.
