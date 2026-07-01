# Spray GenX Manager System — Main Job Record Structure

The Job record is the center of the Spray GenX manager system.

Every customer, proposal, invoice, mileage entry, photo set, task, document, and portfolio entry should be able to connect back to one permanent job ID.

## Job ID Rule

Every job gets one permanent ID.

Recommended format:

```text
JOB-YYYY-0001
```

Examples:

```text
JOB-2026-0001
JOB-2026-0002
JOB-2026-0003
```

The job ID should never change, even if the title, customer name, scope, or address changes later.

## Job Record Purpose

The job record exists to answer these questions quickly:

- Who is the job for?
- Where is the job?
- What is the scope?
- What stage is it in?
- What is it worth?
- What is the next action?
- Are there proposals or invoices attached?
- Are there job photos attached?
- Is it portfolio-worthy?
- Is mileage connected?
- Is the customer paid up?
- Does anything need follow-up?

---

## Core Job Fields

### Identity

```json
{
  "job_id": "JOB-2026-0001",
  "job_title": "Canton Car Wash Brick Coating",
  "job_slug": "canton-car-wash-brick-coating",
  "job_type": "commercial",
  "job_category": "block-metal",
  "status": "proposal_sent"
}
```

Required fields:

- `job_id`
- `job_title`
- `job_slug`
- `job_type`
- `job_category`
- `status`

Suggested `job_type` values:

- residential
- commercial
- industrial
- government
- restoration
- internal
- subcontract

Suggested `job_category` values:

- commercial-ceilings
- commercial-interiors
- block-metal
- machinery-cranes
- epoxy-floors
- residential-interiors
- residential-exteriors
- restoration
- specialty-coatings
- admin

---

### Customer / Contractor Link

```json
{
  "customer_id": "CUST-2026-0001",
  "customer_display_name": "Example General Contractor",
  "contact_type": "general_contractor",
  "primary_contact_name": "John Smith"
}
```

Purpose:

- connect job to a customer or contractor record
- avoid retyping customer details across proposals and invoices
- allow repeat-client history later

Suggested `contact_type` values:

- homeowner
- business_owner
- general_contractor
- property_manager
- subcontract_relationship
- vendor
- internal

---

### Location

```json
{
  "site_name": "Canton Car Wash",
  "address_line_1": "",
  "address_line_2": "",
  "city": "Canton",
  "state": "OH",
  "zip": "",
  "county": "Stark",
  "service_area": "Northeast Ohio"
}
```

Purpose:

- connect estimates, mileage, job photos, and portfolio location references
- keep site location separate from billing contact when needed

---

### Scope Summary

```json
{
  "scope_short": "Brick masonry coating using Loxon XP.",
  "scope_full": "Prepare and coat exterior brick masonry surfaces with two coats of Loxon XP as specified.",
  "surface_types": [
    "brick",
    "masonry"
  ],
  "materials": [
    "Sherwin-Williams Loxon XP"
  ],
  "access_notes": "Lift supplied by GC.",
  "exclusions": "Materials and lift supplied by others unless otherwise stated."
}
```

Purpose:

- store plain-language job scope
- support proposals and invoices
- preserve useful project notes
- help create portfolio descriptions later

---

### Dates

```json
{
  "created_date": "2026-07-01",
  "estimate_date": "",
  "proposal_sent_date": "",
  "approved_date": "",
  "scheduled_start_date": "",
  "actual_start_date": "",
  "completion_date": "",
  "invoice_sent_date": "",
  "paid_date": ""
}
```

Purpose:

- track job movement
- support follow-ups
- support reports
- avoid relying on memory

---

### Financial Summary

```json
{
  "estimated_value": 15750.00,
  "approved_value": 15750.00,
  "invoice_total": 15750.00,
  "amount_paid": 0.00,
  "balance_due": 15750.00,
  "pricing_type": "fixed_price",
  "tax_exempt": false,
  "payment_status": "unpaid"
}
```

Suggested `pricing_type` values:

- fixed_price
- time_and_material
- square_foot
- day_rate
- subcontract
- internal

Suggested `payment_status` values:

- not_billable_yet
- unbilled
- invoiced
- partially_paid
- paid
- overdue
- void

---

### Linked Records

```json
{
  "proposal_ids": [
    "PROP-2026-0001"
  ],
  "invoice_ids": [
    "INV-2026-0001"
  ],
  "photo_group_ids": [
    "PHOTO-2026-0001"
  ],
  "mileage_ids": [
    "MILE-2026-0001"
  ],
  "task_ids": [
    "TASK-2026-0001"
  ],
  "portfolio_project_id": ""
}
```

Purpose:

- connect the entire manager system without duplicating data
- let proposals, invoices, photos, mileage, tasks, and portfolio entries point back to the same job

---

### Job Photos

```json
{
  "photo_status": "needs_review",
  "photo_folder": "images/jobs/JOB-2026-0001/",
  "portfolio_candidate": true,
  "portfolio_approved": false,
  "before_after_available": true,
  "cover_photo": ""
}
```

Suggested `photo_status` values:

- none
- inbox
- needs_review
- archived
- portfolio_candidate
- approved_for_website
- published

---

### Portfolio Publishing

```json
{
  "portfolio_candidate": true,
  "portfolio_category": "block-metal",
  "portfolio_title": "Car Wash Masonry Coating",
  "portfolio_description": "Durable water-resistant masonry coating for a commercial car wash exterior.",
  "portfolio_visible": false,
  "portfolio_published_date": ""
}
```

Purpose:

- separate private job record from public website content
- allow selected jobs to feed the existing portfolio system
- prevent unfinished job data from becoming public accidentally

---

### Follow-Up / Next Action

```json
{
  "next_action": "Follow up on proposal approval.",
  "next_action_due": "2026-07-05",
  "priority": "normal",
  "assigned_to": "owner",
  "follow_up_required": true
}
```

Suggested `priority` values:

- low
- normal
- high
- urgent

---

### Notes

```json
{
  "field_notes": "GC supplying lift. Confirm warranty language before final invoice.",
  "private_notes": "Subcontract relationship. Track mileage separately.",
  "customer_notes": "Customer prefers text updates."
}
```

Purpose:

- separate field notes, private notes, and customer-facing notes
- avoid accidentally publishing private business context

---

### Audit / Maintenance

```json
{
  "created_by": "owner",
  "created_at": "2026-07-01T00:00:00-04:00",
  "updated_at": "2026-07-01T00:00:00-04:00",
  "archived": false,
  "archive_reason": ""
}
```

Purpose:

- support future editing and backups
- make it easier to troubleshoot changed records later

---

## Full Example Job Record

```json
{
  "job_id": "JOB-2026-0001",
  "job_title": "Canton Car Wash Brick Coating",
  "job_slug": "canton-car-wash-brick-coating",
  "job_type": "commercial",
  "job_category": "block-metal",
  "status": "proposal_sent",

  "customer_id": "CUST-2026-0001",
  "customer_display_name": "Example General Contractor",
  "contact_type": "general_contractor",
  "primary_contact_name": "John Smith",

  "location": {
    "site_name": "Canton Car Wash",
    "address_line_1": "",
    "address_line_2": "",
    "city": "Canton",
    "state": "OH",
    "zip": "",
    "county": "Stark",
    "service_area": "Northeast Ohio"
  },

  "scope": {
    "scope_short": "Brick masonry coating using Loxon XP.",
    "scope_full": "Prepare and coat exterior brick masonry surfaces with two coats of Loxon XP as specified.",
    "surface_types": [
      "brick",
      "masonry"
    ],
    "materials": [
      "Sherwin-Williams Loxon XP"
    ],
    "access_notes": "Lift supplied by GC.",
    "exclusions": "Materials and lift supplied by others unless otherwise stated."
  },

  "dates": {
    "created_date": "2026-07-01",
    "estimate_date": "",
    "proposal_sent_date": "",
    "approved_date": "",
    "scheduled_start_date": "",
    "actual_start_date": "",
    "completion_date": "",
    "invoice_sent_date": "",
    "paid_date": ""
  },

  "financials": {
    "estimated_value": 15750.00,
    "approved_value": 15750.00,
    "invoice_total": 15750.00,
    "amount_paid": 0.00,
    "balance_due": 15750.00,
    "pricing_type": "fixed_price",
    "tax_exempt": false,
    "payment_status": "unpaid"
  },

  "links": {
    "proposal_ids": [
      "PROP-2026-0001"
    ],
    "invoice_ids": [],
    "photo_group_ids": [],
    "mileage_ids": [],
    "task_ids": [],
    "portfolio_project_id": ""
  },

  "photos": {
    "photo_status": "none",
    "photo_folder": "images/jobs/JOB-2026-0001/",
    "portfolio_candidate": true,
    "portfolio_approved": false,
    "before_after_available": false,
    "cover_photo": ""
  },

  "portfolio": {
    "portfolio_candidate": true,
    "portfolio_category": "block-metal",
    "portfolio_title": "Car Wash Masonry Coating",
    "portfolio_description": "Durable water-resistant masonry coating for a commercial car wash exterior.",
    "portfolio_visible": false,
    "portfolio_published_date": ""
  },

  "follow_up": {
    "next_action": "Follow up on proposal approval.",
    "next_action_due": "2026-07-05",
    "priority": "normal",
    "assigned_to": "owner",
    "follow_up_required": true
  },

  "notes": {
    "field_notes": "GC supplying lift. Confirm warranty language before final invoice.",
    "private_notes": "Subcontract relationship. Track mileage separately.",
    "customer_notes": "Customer prefers text updates."
  },

  "audit": {
    "created_by": "owner",
    "created_at": "2026-07-01T00:00:00-04:00",
    "updated_at": "2026-07-01T00:00:00-04:00",
    "archived": false,
    "archive_reason": ""
  }
}
```

---

## Required Fields for MVP

For the first usable version, every job should have at least:

- `job_id`
- `job_title`
- `job_slug`
- `job_type`
- `job_category`
- `status`
- `customer_id`
- `customer_display_name`
- `location.city`
- `location.state`
- `scope.scope_short`
- `dates.created_date`
- `financials.estimated_value`
- `follow_up.next_action`
- `follow_up.follow_up_required`

---

## Recommended First Build

Start with one JSON file containing sample jobs:

```text
data/manager/jobs.json
```

Later, if the data grows, split records into separate files:

```text
data/manager/jobs/JOB-2026-0001.json
data/manager/jobs/JOB-2026-0002.json
data/manager/jobs/JOB-2026-0003.json
```

For Sprint 2, use one file first to keep the build simple.
