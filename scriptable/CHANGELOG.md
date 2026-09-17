# Spray GenX Studio Changelog

## v0.9
- Added unified Scriptable field app in `scriptable/SprayGenXUnified.js`.
- One iPhone entry point for proposals, invoices, proposal-to-invoice conversion, document counts, portfolio projects, category management, portfolio counts, and website logo replacement.
- Keeps `scriptable/SprayGenXStudio.js` as the portfolio fallback.
- Keeps `scriptable/SprayGenXManager.js` as the proposal/invoice Manager fallback.
- Uses Manager JSON paths, `document_index.json`, and `manager-index.json` for proposal/invoice records.
- Adds backup-before-save behavior for Manager proposal/invoice records and indexes.

## v0.8
- Added proposal/invoice Manager sync MVP in `scriptable/SprayGenXManager.js`.
- Creates Manager proposal records.
- Creates Manager invoice records.
- Converts active proposals into draft invoices.
- Updates `data/manager/document_index.json` and `data/manager/manager-index.json`.
- Adds backup-before-save behavior for Manager record writes.

## v0.7
- Added compact Scriptable master file in `scriptable/SprayGenXStudio.js`.
- Reads `data/portfolio.json` from GitHub.
- Shows project/photo counts by category.
- Adds new projects.
- Supports multiple JPEG uploads from Files.
- Updates `portfolio.json` after uploads.
- Includes basic project management: edit title, edit description, hide/show, change category, and add photos.
- Rejects non-JPEG file paths to avoid HEIC files being uploaded as broken `.jpg` images.

## v0.6
- Local development copy only.
- Added dashboard, multi-file upload concept, and manage-project structure.

## v0.5
- Proof-of-concept upload and portfolio update from Scriptable.

## v0.2
- Confirmed Scriptable can write to `data/portfolio.json`.

## v0.1
- Confirmed Scriptable can read `data/portfolio.json` through the GitHub API.
