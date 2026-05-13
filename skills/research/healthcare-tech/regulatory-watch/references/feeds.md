# Regulatory feeds

Public RSS/Atom endpoints for FDA, MHRA, and EMA. All readable via the
`WebFetch` tool (no auth, public XML).

## FDA (US)

- 510(k) clearances:
  `https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medical-devices/rss.xml`
- Drug approvals:
  `https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml`
- Recalls, market withdrawals, safety alerts:
  `https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml`
- MedWatch safety alerts:
  `https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml`

FDA RSS items carry `title`, `link`, `pubDate`, `description` (HTML
escaped). The `link` resolves to the full notice page; `description`
holds a short blurb usable as-is for the digest.

## MHRA (UK)

- Drug safety updates:
  `https://www.gov.uk/drug-safety-update.atom`
- Medical device alerts:
  `https://www.gov.uk/drug-device-alerts.atom`

GOV.UK uses Atom 1.0, not RSS 2.0. `<entry>` with `<title>`, `<link>`,
`<updated>`, `<summary>`.

## EMA (EU)

- News: `https://www.ema.europa.eu/en/rss.xml`
- (EMA does not publish a per-product approvals feed; news feed
  carries CHMP opinions and authorizations.)

## CE marking (EU MDR)

No single CE RSS exists. CE certificates are issued by individual
Notified Bodies (BSI, TUV, Dekra, etc.); each publishes irregularly.
For now, treat MHRA + EMA as the EU surrogate and note the gap in
the digest's "Coverage" section.

## Device class taxonomy

For classification in the digest:
- **FDA:** Class I (low risk), II (moderate, 510(k) typical),
  III (high risk, PMA required).
- **EU MDR:** Class I, IIa, IIb, III. Software-as-a-medical-device
  (SaMD) is typically IIa or IIb under MDR Rule 11.

## Etiquette

- These are static XML files served from CDNs. No documented rate
  limit but a single GET per feed per run is plenty.
- WebFetch may cache; force fresh by appending `?cb=<unix-ts>` if a
  feed appears stale.
- HTML-escaped entities in RSS `description` must be unescaped once
  before any Markdown formatting.
