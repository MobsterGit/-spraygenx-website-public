# Spray GenX Legacy Redirect Map

Updated: 2026-08-02
Canonical host: `https://spraygenx.com`

## Phase 1 ceiling authority recovery

| Legacy URL | Canonical destination | Repository action |
|---|---|---|
| `https://www.spraygenx.com/spray-genx-industrial-painting/` | `https://spraygenx.com/industrial-ceiling-painting/` | Added noindex redirect stub and canonical |
| `https://www.spraygenx.com/flat-black-ceiling-spray/` | `https://spraygenx.com/industrial-ceiling-painting/` | Added noindex redirect stub and canonical |
| `https://www.spraygenx.com/competitive-ceiling-spray-rates/` | `https://spraygenx.com/industrial-ceiling-painting/#pricing` | Added noindex redirect stub and canonical |
| `https://www.spraygenx.com/commercial-dryfall-ceiling-painting-dealership/` | `https://spraygenx.com/industrial-ceiling-painting/` | Added noindex redirect stub and canonical |
| `https://spraygenx.com/industrial-ceiling-painting.html` | `https://spraygenx.com/industrial-ceiling-painting/` | Added noindex redirect stub and canonical |

## GitHub Pages limitation

GitHub Pages does not provide repository-controlled HTTP 301 redirect rules. The HTML redirect stubs in this branch preserve a crawlable path, declare the new canonical URL, and immediately send visitors to the replacement page, but they return an HTTP 200 response rather than a true 301.

For the strongest migration signal, configure these redirects at the CDN, reverse proxy, or future hosting platform when server-level redirect control is available.

## Host normalization still required outside this repository

Confirm that every `https://www.spraygenx.com/*` request permanently redirects to the matching `https://spraygenx.com/*` URL. The repository CNAME already declares `spraygenx.com`, but DNS and hosting behavior determine whether the `www` host returns a permanent redirect.

## Verification checklist after deployment

1. Open every legacy URL and confirm it reaches the intended destination.
2. Confirm the destination returns HTTP 200 and contains the expected canonical tag.
3. Confirm the legacy stub contains `noindex,follow`.
4. Resubmit `https://spraygenx.com/sitemap.xml` in Google Search Console.
5. Inspect the new industrial ceiling page and each legacy URL in Search Console.
6. Monitor indexing, impressions, queries, clicks and canonical selection for at least eight weeks.
