# Spray GenX Manager System — Follow-Up Task Record Structure

The Follow-Up Task record tracks next actions that would otherwise get buried in texts, notes, memory, or old proposals.

## Task ID Rule

Every task gets one permanent ID.

Recommended format:

```text
TASK-YYYY-0001
```

Examples:

```text
TASK-2026-0001
TASK-2026-0002
TASK-2026-0003
```

The task ID should never change, even if the due date, priority, status, or linked job changes later.

## Task Record Purpose

The record exists to answer these questions quickly:

- What needs done next?
- Who or what is it connected to?
- When is it due?
- Is it a call, estimate, proposal, invoice, photo, material, collection, review, or callback task?
- Is it open, waiting, complete, or archived?

---

## Core Task Fields

### Identity

```json
{
  "task_id": "TASK-2026-0001",
  "task_title": "Follow up on proposal approval",
  "task_type": "follow_up",
  "status": "open",
  "priority": "normal"
}
```

Required fields:

- `task_id`
- `task_title`
- `task_type`
- `status`
- `priority`

Suggested `task_type` values:

- call_customer
- send_proposal
- revise_proposal
- schedule_job
- order_material
- upload_photos
- send_invoice
- collect_payment
- request_review
- add_to_portfolio
- warranty_callback
- general_follow_up

Suggested `status` values:

- open
- waiting
- scheduled
- complete
- canceled
- archived

Suggested `priority` values:

- low
- normal
- high
- urgent

---

### Linked Records

```json
{
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "proposal_id": "PROP-2026-0001",
  "invoice_id": "",
  "photo_group_id": "",
  "mileage_id": ""
}
```

Purpose:

- connect each task to the related business record
- support a simple dashboard grouped by job, customer, or task type

---

### Dates

```json
{
  "created_date": "2026-07-01",
  "due_date": "2026-07-05",
  "scheduled_date": "",
  "completed_date": "",
  "snoozed_until": ""
}
```

Purpose:

- make follow-ups visible
- prevent missed proposal approvals, invoices, collections, and callbacks

---

### Task Details

```json
{
  "description": "Follow up with GC on proposal approval.",
  "assigned_to": "owner",
  "communication_method": "text",
  "customer_facing": false,
  "private_notes": "Keep internal pricing notes private."
}
```

Suggested `communication_method` values:

- call
- text
- email
- in_person
- none

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

---

## Full Example Follow-Up Task Record

```json
{
  "task_id": "TASK-2026-0001",
  "task_title": "Follow up on proposal approval",
  "task_type": "general_follow_up",
  "status": "open",
  "priority": "normal",

  "links": {
    "job_id": "JOB-2026-0001",
    "customer_id": "CUST-2026-0001",
    "proposal_id": "PROP-2026-0001",
    "invoice_id": "",
    "photo_group_id": "",
    "mileage_id": ""
  },

  "dates": {
    "created_date": "2026-07-01",
    "due_date": "2026-07-05",
    "scheduled_date": "",
    "completed_date": "",
    "snoozed_until": ""
  },

  "details": {
    "description": "Follow up with GC on proposal approval.",
    "assigned_to": "owner",
    "communication_method": "text",
    "customer_facing": false,
    "private_notes": "Keep internal pricing notes private."
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

## Dashboard Rule

The first manager dashboard should show open tasks grouped by:

- overdue
- due today
- upcoming
- waiting
- high priority

Completed and archived tasks should stay out of the active dashboard unless intentionally filtered.
