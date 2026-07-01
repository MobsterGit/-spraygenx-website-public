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
- [x] Define manager-system modules.
- [x] Define the main job record structure. See `docs/manager-system-job-record.md`.
- [ ] Define customer / contractor record structure.
- [ ] Define proposal record structure.
- [ ] Define invoice record structure.
- [ ] Define mileage record structure.
- [ ] Define photo / portfolio record structure.
- [ ] Define follow-up task record structure.

---

## Defined Manager-System Modules

These are the working modules for the Spray GenX manager system.

### 1. Jobs

The Jobs module is the center of the system.

Every estimate, proposal, invoice, photo set, mileage entry, follow-up, and portfolio candidate should be able to connect back to a job record.

Purpose:

- track active and past work
- reduce forgotten follow-ups
- connect job photos to business records
- connect proposals, invoices, and payments
- create a reliable job history
- support future reporting

Core records connected to Jobs:

- customer / contractor
- site address
- scope
- proposal
- invoice
- photos
- mileage
- notes
- follow-up tasks
- portfolio entries

### 2. Customers / Contractors

The Customers / Contractors module stores people and companies Spray GenX works for or with.

This should handle both homeowner customers and commercial/GC relationships.

Purpose:

- avoid retyping names, phone numbers, and emails
- track repeat customers and contractors
- separate direct customers from subcontract / GC contacts
- support proposals, invoices, follow-ups, and relationship history

Suggested contact types:

- homeowner
- business owner
- general contractor
- property manager
- subcontract relationship
- supplier / vendor
- internal / personal reference

### 3. Proposals

The Proposals module tracks estimates before they become approved work.

Purpose:

- create professional customer-facing proposals
- save scope language for reuse
- connect proposed work to a job record
- convert approved proposals into invoices
- track open, accepted, rejected, or revised proposals

Proposal status examples:

- draft
- sent
- revised
- approved
- declined
- expired
- converted to invoice

### 4. Invoices

The Invoices module tracks billable work and payment status.

Purpose:

- convert approved proposals into invoices
- track invoice numbers
- track sent / unpaid / paid / overdue status
- preserve a business record for tax and accounting use
- support clean PDF export

Invoice status examples:

- draft
- sent
- partially paid
- paid
- overdue
- void

### 5. Mileage

The Mileage module connects business driving to jobs, estimates, suppliers, and admin errands.

Purpose:

- reduce year-end mileage pain
- connect trips to jobs whenever possible
- support business vs personal classification
- create accountant-friendly exports
- preserve notes for unusual trips

Mileage should support:

- date
- origin
- destination
- miles
- purpose
- job link
- business / personal / mixed classification
- source import notes

### 6. Photos

The Photos module manages job photos before they become website portfolio content.

Purpose:

- collect field photos by job
- separate business archive photos from public website photos
- support before / after grouping
- identify cover photos
- prepare selected photos for portfolio publishing

Photo states:

- inbox
- job archive
- portfolio candidate
- approved for website
- published
- hidden / rejected

### 7. Portfolio Publishing

The Portfolio Publishing module controls what job photos and project writeups become public website content.

Purpose:

- protect the public site from messy work-in-progress data
- map job photos into existing `data/portfolio.json`
- organize projects by category
- define title, description, cover, captions, and visibility
- preserve the existing static JSON-driven site model

This module should only publish selected, approved content.

### 8. Follow-Up Tasks

The Follow-Up Tasks module tracks next actions that otherwise get buried in texts, memory, or notes.

Purpose:

- track calls, estimates, touch-ups, collections, callbacks, and warranty items
- keep job movement visible
- make the dashboard useful every morning
- reduce missed money and missed communication

Task examples:

- call customer
- send proposal
- revise proposal
- schedule job
- order material
- upload photos
- send invoice
- collect payment
- request review
- add project to portfolio

### 9. Reports / Exports

The Reports / Exports module turns stored records into usable business output.

Purpose:

- support tax prep
- export proposals and invoices
- summarize yearly work
- summarize contractor/customer revenue
- export mileage
- prepare accountant-friendly CSV files
- eventually show business totals without digging through files

Initial export targets:

- yearly job summary CSV
- proposal log CSV
- invoice log CSV
- mileage CSV
- customer / contractor CSV
- tax support CSV

### 10. Settings / Templates

The Settings / Templates module stores reusable defaults.

Purpose:

- avoid rewriting common scope language
- define numbering rules
- define company info
- define proposal and invoice language
- define payment terms
- define portfolio category names
- define default export folders

Template examples:

- proposal intro language
- invoice payment terms
- common painting scope blocks
- warranty / exclusions language
- customer-facing project descriptions
- default notes

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

Define customer / contractor record structure.

The customer / contractor record should connect repeat contacts, billing details, job history, proposals, invoices, and follow-up context without forcing repeated data entry.

---

## Notes

This checklist should be updated as each item is completed.

Do not mark an item complete until the related structure, file, or decision actually exists in the repository or workflow.
