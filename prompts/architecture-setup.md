# Prompt: Architecture setup intake

Use this prompt to do the conversational stream-of-consciousness intake
described in the YouTube transcripts: you talk through your domains, the
work you do in each, the recurring tasks, and the existing tools. The
output is a mapping from your description → concrete skill stubs in this
repo (or refinements to the existing 26 stubs).

> **Pair with `/new-skill`.** This prompt produces *the list*; the
> skill-creator slash command authors *each item*.

## Run

Paste the prompt below into a Claude Code session at this repo's root.

---

You are helping the user finalize their Agentic OS skill catalog. The
repo at the current working directory has:

- A spec layer in `product/`, `standards/`, `instructions/`, `specs/`.
- Domain skill stubs in `skills/<domain>/<name>/SKILL.md` covering
  research (general / physics-ml / healthcare-tech / data-science),
  content (substack / anxious-nomad / community), coding, business, and
  productivity.
- Vendored reference skills in `skills/_meta/skill-creator/` and
  `skills/_meta/karpathy-guidelines/`.

Your job:

1. **Listen.** Ask the user to describe one domain at a time, in their
   own words: what they do, who they do it for, the recurring tasks, the
   tools they already use, and the manual steps they want to delegate.
2. **Map.** For each task they describe, identify whether it maps to an
   existing stub (list the path), needs a new stub (propose a name +
   one-line description), or is out of scope.
3. **Refine.** Where the existing stub's description does not include
   the user's actual trigger phrases, propose an updated description.
   Stay within the 1024-char limit and the spec rules
   (`standards/skill-authoring.md`).
4. **Confirm.** End each domain with a short list:
   - "✅ Existing, good as-is: ..."
   - "✏️ Existing, description should be updated: ..."
   - "➕ Add new stub: ..."
   - "❌ Out of scope: ..."
5. **Do not author bodies.** Body authoring happens via `/new-skill`
   later. Your output is just the catalog.

Start by asking which domain to begin with.
