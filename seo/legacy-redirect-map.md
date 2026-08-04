# Spray GenX Legacy Redirect Map

Updated: 2026-08-04  
Canonical host: `https://spraygenx.com`

## Search Console recovery strategy

The August 4, 2026 Search Console exports showed 30 URLs reported as not found and a sharp indexing decline after the late-June rebuild. Search performance data still showed impressions and clicks for several legacy WordPress routes.

Recovery uses two layers:

1. **AWS Amplify 301 rules** for permanent server-level redirects.
2. **Repository fallback pages** using `noindex,follow`, canonical tags, meta refresh and JavaScript replacement so ranked legacy paths do not return a bare 404 if Amplify rules are temporarily out of sync.

`r.sh` loads `amplify-redirects-recovery.json` before `amplify-redirects.json`. Duplicate sources are deduplicated with the recovery mapping taking precedence.

## Ceiling authority recovery

| Legacy path | Canonical destination |
|---|---|
| `/spray-genx-industrial-painting/` | `/industrial-ceiling-painting/` |
| `/ceiling-spray-painting/` | `/industrial-ceiling-painting/` |
| `/industrial-painting/dry-fall-painting/` | `/industrial-ceiling-painting/` |
| `/commercial-dryfall-ceiling-painting-dealership/` | `/industrial-ceiling-painting/` |
| `/industrial-ceiling-painting.html` | `/industrial-ceiling-painting/` |
| `/competitive-ceiling-spray-rates/` | `/industrial-ceiling-painting/#pricing` |
| `/flat-black-ceiling-spray/` | `/reports/flat-black-open-deck-ceiling-painting/` |
| `/flat-black-ceiling-spray-painting/` | `/reports/flat-black-open-deck-ceiling-painting/` |

## Commercial and industrial legacy routes

| Legacy path | Canonical destination |
|---|---|
| `/industrial-spray/` | `/services.html` |
| `/industrial-painting/industrial-spray/` | `/services.html` |
| `/industrial-painting/scheduled-painting-maintenance/` | `/services.html` |
| `/industrial-painting/painting-contracting/` | `/services.html` |
| `/industrial-painting/painting-business/` | `/about.html` |
| `/industrial-paint-guide/` | `/services.html` |
| `/low-risk-and-high-result/` | `/services.html` |
| `/sub-contracting/` | `/services.html` |
| `/industrial-painting-consulting/` | `/services.html` |

## Portfolio, restoration and contact routes

| Legacy path | Canonical destination |
|---|---|
| `/photos/` | `/gallery.html` |
| `/projects/` | `/gallery.html` |
| `/ultra-high-pressure-water-blasting-40000psi/` | `/gallery.html` |
| `/hitachi-machine-refinish/` | `/gallery.html` |
| `/aluminum-soffit-painting/` | `/gallery.html` |
| `/interior-exterior-painting-restoration/` | `/restoration-projects/` |
| `/plan-your-painting-project/` | `/contact.html` |
| `/scheduling-spring-2019/` | `/contact.html` |
| `/contact/` | `/contact.html` |
| `/contact-us/` | `/contact.html` |
| `/news/` | `/regional-updates.html` |

## Host and format normalization

- `https://www.spraygenx.com/*` permanently redirects to the matching non-`www` HTTPS destination.
- Extensionless legacy navigation routes redirect to the current `.html` pages.
- `/index.html` redirects to `/`.
- The sitemap contains only preferred non-`www` HTTPS URLs.

## Deployment and verification

1. Merge the recovery branch.
2. Run `r.sh` in the authenticated AWS environment to update the Amplify app’s `customRules`.
3. Confirm each live check returns `301` with the intended `Location` header.
4. Resubmit `https://spraygenx.com/sitemap.xml` in Search Console.
5. Inspect the homepage, industrial ceiling page, flat-black report, portfolio and restoration pages.
6. Start validation for the 404, redirect and duplicate-canonical issues after the live rules are confirmed.
7. Monitor indexed pages, impressions, clicks and Google-selected canonicals weekly for at least eight weeks.
