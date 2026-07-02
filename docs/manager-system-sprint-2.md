# Spray GenX Manager System — Sprint 2 Checklist

This checklist is the working sprint tracker for the Spray GenX owner-side manager system.

## Sprint 2 Objective

Build the lightweight manager-system foundation around the existing static Spray GenX website, JSON data workflow, GitHub Pages setup, and Scriptable proposal / invoice workflow.

The system should help manage:

- jobs
- customers / contractors
- proposals
- invoices
- mileage
- job photos
- portfolio publishing
- follow-up tasks
- reports / exports
- settings / templates

## Ground Rules

- Keep it lightweight.
- Avoid unnecessary subscriptions.
- Avoid heavy CMS logic.
- Build around the existing static website and JSON workflow.
- Make it usable from an iPhone first.
- Minimize data entry.
- Do not disturb the public website unless the checklist item specifically requires it.
- Keep manager data separate from public portfolio data until content is intentionally approved for publishing.
- Continue using Scriptable as the field-facing proposal / invoice app unless a later sprint deliberately replaces it.
- Avoid endless scrolling for proposals and invoices; active work should appear first, with older records available through sortable history views.
- Treat backup and recovery as core infrastructure, not an optional feature.

---

## Phase 1 — Manager System Blueprint

- [x] Confirm GitHub connection restored.
- [x] Confirm active repository: `MobsterGit/-spraygenx-website-public`.
- [x] Confirm current site foundation: static HTML, CSS, vanilla JavaScript, JSON portfolio data, GitHub Pages, Scriptable workflow.
- [x] Create Sprint 2 checklist document.
- [x] Define manager-system modules.
- [x] Define main job record structure: `docs/manager-system-job-record.md`.
- [x] Define customer / contractor record structure: `docs/manager-system-customer-contractor-record.md`.
- [x] Define proposal record structure: `docs/manager-system-proposal-record.md`.
- [x] Define invoice record structure: `docs/manager-system-invoice-record.md`.
- [x] Define mileage record structure: `docs/manager-system-mileage-record.md`.
- [x] Define photo record structure: `docs/manager-system-photo-record.md`.
- [x] Define photo / portfolio record structure: `docs/manager-system-photo-portfolio-record.md`.
- [x] Define follow-up task record structure: `docs/manager-system-follow-up-task-record.md`.

---

## Phase 2 — File and Folder Structure

- [x] Decide where manager data lives: `data/manager/`.
- [x] Create proposed manager folder structure: `data/manager/README.md`.
- [x] Separate website portfolio data from business-management data.
- [x] Preserve public website portfolio data at `data/portfolio.json`.
- [x] Define backup/export structure in `data/manager/README.md`.
- [x] Define naming rules for jobs, customers, proposals, invoices, mileage, media, tasks, and portfolio publishing records.
- [x] Create manager index file: `data/manager/manager-index.json`.

---

## Phase 3 — Job Manager MVP

- [x] Create basic job JSON template: `data/manager/templates/job-template.json`.
- [x] Create sample job record: `data/manager/jobs/JOB-2026-0001.json`.
- [x] Add job statuses:
  - [x] lead
  - [x] estimate needed
  - [x] proposal sent
  - [x] approved
  - [x] scheduled
  - [x] active
  - [x] complete
  - [x] invoiced
  - [x] paid
  - [x] archived
- [x] Add basic job fields:
  - [x] job title
  - [x] customer / contractor
  - [x] location
  - [x] scope summary
  - [x] estimated value
  - [x] actual value
  - [x] start date
  - [x] completion date
  - [x] notes
  - [x] next action
- [x] Add link fields for photos, proposals, invoices, mileage, tasks, and portfolio entries.
- [x] Build add-job workflow in the manager interface.
- [ ] Build edit-job workflow in the manager interface.
- [x] Build job list / job detail view from `data/manager/manager-index.json`.

---

## Phase 4 — Proposal / Invoice Manager

- [x] Review existing Scriptable proposal/invoice workflow at a structure level.
- [x] Define proposal number format.
- [x] Define invoice number format.
- [x] Create proposal JSON template: `data/manager/templates/proposal-template.json`.
- [x] Create invoice JSON template: `data/manager/templates/invoice-template.json`.
- [x] Create sample proposal record: `data/manager/proposals/PROP-2026-0001.json`.
- [x] Create sample invoice record: `data/manager/invoices/INV-2026-0001.json`.
- [x] Decision: keep Scriptable as the primary field-facing proposal / invoice interface for now.
- [ ] Decide final sync behavior between Scriptable iCloud files and `data/manager/` records.
- [ ] Define convert-proposal-to-invoice logic.
- [ ] Define PDF export requirements.
- [ ] Define customer-facing document style.
- [x] Build active proposal window: show only current in-progress proposals first, not the entire archive.
- [x] Build active invoice window: show only open / unpaid invoices first, not the entire archive.
- [x] Define active proposal limit target: roughly 20 visible working records before history browsing is needed.
- [x] Define active invoice limit target: open invoices visible first; paid invoices move out of daily view.
- [x] Build Browse History view for older proposals and invoices.
- [x] Add sortable history filters by year, month, week, customer, job, status, amount, and search text.
- [x] Auto-remove proposals from active view after conversion to invoice or archive.
- [x] Auto-remove invoices from active view after marked paid or archived.
- [x] Create `document_index.json` concept for fast proposal/invoice search, sorting, linking, and recovery.
- [x] Preserve existing proposal and invoice PDFs / JSON files; index them rather than forcing a physical folder move.

---

## Phase 5 — Photo and Portfolio Manager

- [x] Review current portfolio JSON direction.
- [x] Define media/photo record structure.
- [x] Define photo-to-portfolio structure.
- [x] Create media JSON template: `data/manager/templates/media-template.json`.
- [x] Create portfolio project JSON template: `data/manager/templates/portfolio-project-template.json`.
- [x] Create sample media record: `data/manager/media/MEDIA-2026-0001.json`.
- [ ] Define upload inbox rules.
- [ ] Define converted image naming rules.
- [ ] Define project category rules.
- [ ] Define when job photos become website portfolio photos.
- [ ] Define before / after grouping rules.
- [ ] Define cover image selection rules.
- [ ] Define caption rules.
- [ ] Define visibility rules.

---

## Phase 6 — Mileage and Tax Support

- [x] Define mileage record structure.
- [x] Create mileage JSON template: `data/manager/templates/mileage-template.json`.
- [x] Create sample mileage record: `data/manager/mileage/MILE-2026-0001.json`.
- [ ] Define mileage import format.
- [ ] Define job-to-mileage matching rules.
- [ ] Define business vs personal classification rules.
- [ ] Define export format for tax records.
- [ ] Define yearly archive process.
- [ ] Define QuickBooks / accountant-friendly CSV export.

---

## Phase 7 — Interface Plan

- [x] Decide first interface: private GitHub-backed static manager page.
- [x] Create first manager page shell: `manager/index.html`.
- [x] Create manager stylesheet: `manager/manager.css`.
- [x] Create manager JavaScript shell: `manager/manager.js`.
- [x] Load manager index JSON into the dashboard.
- [x] Define home dashboard sections.
- [x] Define mobile-first navigation.
- [x] Define add-job workflow.
- [ ] Define update-job workflow.
- [ ] Define add-photo workflow.
- [ ] Define proposal creation workflow.
- [ ] Define invoice creation workflow.
- [ ] Define export / backup workflow.
- [x] Define proposal/invoice UX as two layers: active first window, sortable history second window.
- [x] Define document row format for fast mobile scanning: number, customer/job, amount, status, date, city.

---

## Phase 8 — Backup and Recovery Requirements

- [ ] Add automatic backup before every proposal, invoice, job, customer, media, mileage, or task save.
- [ ] Use safe-write behavior: write temp file, verify JSON opens, back up previous file, then replace active file.
- [ ] Add daily snapshot of document index and active records.
- [ ] Add full backup export button for a dated ZIP-style archive.
- [ ] Add recovery view for restoring last known good proposal, invoice, job, or index file.
- [x] Add version number and last-modified metadata to records.
- [x] Add checksum / validation metadata for critical proposal and invoice JSON files.
- [x] Protect against bulk corruption: accepted proposals, paid invoices, and archived records must remain recoverable from prior snapshots.
- [x] Define backup folder convention: `Backups/YYYY/MM/`, daily snapshots, and full exports.
- [x] Ensure backup workflow works from iPhone / Scriptable, not only from desktop.

---

## Phase 9 — Build Order

- [x] Build job JSON schema first.
- [x] Build sample data second.
- [x] Build basic manager dashboard shell third.
- [x] Build dashboard data loading fourth.
- [x] Build active proposal / active invoice windows fifth.
- [x] Build sortable proposal / invoice history browser sixth.
- [ ] Build backup / recovery foundation seventh.
- [ ] Build add/edit job workflow eighth.
- [ ] Connect proposals and invoices ninth.
- [ ] Connect photos and portfolio tenth.
- [ ] Connect mileage eleventh.
- [ ] Polish mobile usability last.

---

## Current Next Task

Build the backup / recovery foundation and connect Scriptable field saves to Manager records without breaking the current proposal / invoice workflow.

Priority order:

- define final Scriptable-to-Manager sync behavior
- implement safe-write backup before real record saves
- build convert-proposal-to-invoice logic
- build PDF export requirements and customer-facing document style
- connect imported proposals/invoices to jobs and customers

---

## Notes

Do not mark an item complete until the related structure, file, or decision actually exists in the repository or workflow.
