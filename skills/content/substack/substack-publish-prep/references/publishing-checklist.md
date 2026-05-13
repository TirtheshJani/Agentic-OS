# Substack publishing checklist

Reference for `substack-publish-prep`. These are the fields the user
must paste or set inside Substack's web editor. Substack has no public
publishing API, so this skill produces a paste-ready package, not an
automated push.

## Substack post fields

| Field | Limit | Notes |
|---|---|---|
| Headline | 100 chars (soft); 60 chars best | Shown in feed, email subject, SEO title. Front-load the specific term. |
| Subtitle | 120 chars (soft) | Shown under headline and in email preview. Should add information, not restate the title. |
| Social preview text | 280 chars | Used for Twitter/LinkedIn share cards. Falls back to subtitle if blank. |
| Cover image | 1456×816 recommended | Optional. Generate via Canva or skip. |
| Cover image alt text | 125 chars | Required for accessibility; Substack does not enforce. |
| Tags | up to 5 | Lowercase, space-separated in the UI. |
| Section | one | Only if the publication has multiple sections. |
| Audience | free / paid / paid-trial | Default free unless the user says otherwise. |

## Email-specific fields

| Field | Limit | Notes |
|---|---|---|
| Email subject line | 60 chars best | Defaults to headline; override if the headline is too long. |
| Pre-header | 90 chars | First line shown in inbox preview. Substack uses the subtitle by default. |

## Embeds and links

- Substack auto-embeds: YouTube, Twitter/X, Vimeo, Spotify, SoundCloud,
  GitHub Gist, Loom. Paste the URL on its own line.
- Footnotes: Substack supports them natively. Use `[^1]` style; the
  editor renders them as numbered superscripts.
- Internal cross-references to other posts: paste the full canonical
  URL; Substack converts to a styled card.
- Newsletter recommendations: do not auto-insert; this is a manual
  publication-level setting.

## Pre-publish smoke test

Before the user clicks publish:

- Email subject under 60 chars.
- Subtitle is information, not restatement.
- Cover image alt text is filled.
- Footnotes render (Substack collapses `[^N]` to numbered).
- All external links open in new tabs (Substack does this by default).
- Cross-post toggles set (Notes, recommendations) per user preference.
- Audience setting matches intent (free vs paid).

## What this skill cannot do

- Push the post to Substack. No public API.
- Schedule the post. Manual in the editor.
- Set custom CSS or hero layouts. Substack does not expose either.
- Send a test email to one address. Substack only supports
  publication-owner test sends.

The skill's deliverable is therefore a markdown package the user
copies into the Substack editor, plus a one-page checklist they tick
off in the same session.
