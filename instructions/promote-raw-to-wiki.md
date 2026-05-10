# Promote raw notes to wiki

When a topic in `vault/raw/` reaches a threshold (mentioned in ≥2 daily
notes, or flagged for promotion in a daily review), consolidate it into
`vault/wiki/<domain>/<topic>.md`.

## Steps

1. **Identify the topic.** A short noun phrase, kebab-case for the file
   name (e.g. `attention-mechanism-variants`).
2. **Pick the domain.** Must match an existing folder under
   `vault/wiki/`. If none fits, the topic isn't ready — it belongs in
   `raw/` longer or is mis-domained.
3. **Search the source notes.**
   ```bash
   grep -rli "<topic>" vault/raw/
   ```
4. **Create the wiki page** with frontmatter:
   ```yaml
   ---
   domain: research/physics-ml
   source: promoted-from-raw
   created: <today>
   updated: <today>
   tags: [...]
   ---
   ```
5. **Consolidate.** Pull the relevant paragraphs from each raw note,
   restructure under headings, link back to source raw notes:
   ```md
   See also: [[raw/daily/2026-05-08]], [[raw/daily/2026-05-10]].
   ```
6. **Don't delete the raw notes.** They're history. The promotion is
   one-way: raw → wiki, not move.
7. **Commit.** Promotion commits go on the working branch; they're cheap
   and frequent.

## What does NOT get promoted

- One-off captures with no follow-up.
- Status updates ("today I read X"). Those stay in daily notes.
- Personal observations that aren't reusable knowledge.
