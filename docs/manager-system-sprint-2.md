# Spray GenX Manager System — Sprint 2 Checklist

This checklist is the working sprint tracker for the Spray GenX manager system.

The goal is to build the manager system in small, checkable steps instead of jumping into a large unfinished app.

## Sprint 2 Objective

Create the owner-side manager-system foundation around the existing Spray GenX website workflow.

The system should help manage:

- jobs
- customers / contractors
- proposals
- invoices
- mileage
- job photos
- portfolio publishing
- follow-up tasks

## Ground Rules

- Keep it lightweight.
- Avoid unnecessary subscriptions.
- Avoid heavy CMS logic.
- Build around the existing static website and JSON workflow.
- Make it usable from an iPhone first.
- Minimize data entry.
- Do not disturb the public website unless the checklist item specifically requires it.

---

## Phase 1 — Manager System Blueprint

- [x] Confirm GitHub connection restored.
- [x] Confirm active repository: `MobsterGit/-spraygenx-website-public`.
- [x] Confirm current site foundation: static HTML, CSS, vanilla JavaScript, JSON portfolio data, GitHub Pages, Scriptable workflow.
- [x] Create Sprint 2 checklist document.
- [ ] Define manager-system modules.
- [ ] Define the main job record structure.
- [ ] Define customer / contractor record structure.
- [ ] Define proposal record structure.
- [ ] Define invoice record structure.
- [ ] Define mileage record structure.
- [ ] Define photo / portfolio record structure.
- [ ] Define follow-up task record structure.

---

## Phase 2 — File and Folder Structure

- [ ] Decide where manager data lives.
- [ ] Create proposed `/manager/` or `/data/manager/` folder structure.
- [ ] Decide what stays private vs public.
- [ ] Separate website portfolio data from business-management data.
- [ ] Define backup/export structure.
- [ ] Define naming rules for jobs, customers, proposals, invoices, and photos.

---

## Phase 3 — Job Manager MVP

- [ ] Create basic job JSON template.
- [ ] Create sample job record.
- [ ] Add job statuses:
  - [ ] lead
  - [ ] estimate needed
  - [ ] proposal sent
  - [ ] approved
  - [ ] scheduled
  - [ ] active
  - [ ] complete
  - [ ] invoiced
  - [ ] paid
  - [ ] archived
- [ ] Add basic job fields:
  - [ ] job title
  - [ ] customer / contractor
  - [ ] location
  - [ ] scope summary
  - [ ] estimated value
  - [ ] actual value
  - [ ] start date
  - [ ] completion date
  - [ ] notes
  - [ ] next action
- [ ] Add link fields for photos, proposals, invoices, mileage, and portfolio entries.

---

## Phase 4 — Proposal / Invoice Manager

- [ ] Review existing Scriptable proposal/invoice workflow.
- [ ] Decide whether proposal/invoice data should stay in Scriptable, GitHub, local files, or both.
- [ ] Define proposal number format.
- [ ] Define invoice number format.
- [ ] Create proposal JSON template.
- [ ] Create invoice JSON template.
- [ ] Define convert-proposal-to-invoice logic.
- [ ] Define PDF export requirements.
- [ ] Define customer-facing document style.

---

## Phase 5 — Photo and Portfolio Manager

- [ ] Review current portfolio JSON structure.
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

- [ ] Define mileage import format.
- [ ] Define job-to-mileage matching rules.
- [ ] Define business vs personal classification rules.
- [ ] Define export format for tax records.
- [ ] Define yearly archive process.
- [ ] Define QuickBooks / accountant-friendly CSV export.

---

## Phase 7 — Interface Plan

- [ ] Decide first interface:
  - [ ] Scriptable menu
  - [ ] static local HTML dashboard
  - [ ] private GitHub-backed manager page
  - [ ] desktop Python GUI
- [ ] Define home dashboard sections.
- [ ] Define mobile-first navigation.
- [ ] Define add-job workflow.
- [ ] Define update-job workflow.
- [ ] Define add-photo workflow.
- [ ] Define proposal creation workflow.
- [ ] Define invoice creation workflow.
- [ ] Define export / backup workflow.

---

## Phase 8 — Build Order

- [ ] Build job JSON schema first.
- [ ] Build sample data second.
- [ ] Build basic manager dashboard third.
- [ ] Build add/edit job workflow fourth.
- [ ] Connect proposals and invoices fifth.
- [ ] Connect photos and portfolio sixth.
- [ ] Connect mileage seventh.
- [ ] Polish mobile usability last.

---

## Current Next Task

Define manager-system modules.

Recommended modules:

1. Jobs
2. Customers / Contractors
3. Proposals
4. Invoices
5. Mileage
6. Photos
7. Portfolio Publishing
8. Follow-Up Tasks
9. Reports / Exports
10. Settings / Templates

---

## Notes

This checklist should be updated as each item is completed.

Do not mark an item complete until the related structure, file, or decision actually exists in the repository or workflow.
