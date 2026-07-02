# Spray GenX Manager System — Proposal Record Structure

The Proposal record tracks estimates before they become approved jobs or invoices.

## Proposal ID Rule

Every proposal gets one permanent ID.

Recommended format:

```text
PROP-YYYY-0001
```

Examples:

```text
PROP-2026-0001
PROP-2026-0002
PROP-2026-0003
```

The proposal ID should never change, even if the scope, price, customer, or status changes later.

## Proposal Record Purpose

The record exists to answer these questions quickly:

- Which customer and job is this proposal connected to?
- What scope was proposed?
- What price was quoted?
- Was it drafted, sent, revised, approved, declined, expired, or converted?
- Are there customer-facing notes, exclusions, or payment terms attached?
- Has it been converted into an invoice?

---

## Core Proposal Fields

### Identity

```json
{
  "proposal_id": "PROP-2026-0001",
  "proposal_number": "SGX-PROP-2026-0001",
  "proposal_title": "Canton Car Wash Brick Coating",
  "status": "sent",
  "revision_number": 0
}
```

Required fields:

- `proposal_id`
- `proposal_number`
- `proposal_title`
- `status`
- `revision_number`

Suggested `status` values:

- draft
- sent
- revised
- approved
- declined
- expired
- converted_to_invoice
- archived

---

### Linked Records

```json
{
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "invoice_id": ""
}
```

Purpose:

- connect proposal to the job record
- pull customer details from the customer / contractor record
- connect approved proposals to invoices later

---

### Dates

```json
{
  "created_date": "2026-07-01",
  "sent_date": "",
  "revised_date": "",
  "approved_date": "",
  "declined_date": "",
  "expiration_date": "",
  "converted_to_invoice_date": ""
}
```

Purpose:

- track proposal movement
- support follow-ups
- support reporting on open proposals

---

### Customer-Facing Scope

```json
{
  "scope_intro": "Spray GenX LLC proposes to complete the following work:",
  "scope_items": [
    {
      "item_id": "ITEM-001",
      "description": "Prepare and coat exterior brick masonry surfaces with two coats of Sherwin-Williams Loxon XP.",
      "quantity": 1,
      "unit": "lump_sum",
      "unit_price": 15750.00,
      "line_total": 15750.00
    }
  ],
  "included_work": [
    "Surface preparation as required for coating application",
    "Two finish coats as specified"
  ],
  "excluded_work": [
    "Lift rental supplied by others unless otherwise stated",
    "Material supplied by others unless otherwise stated"
  ]
}
```

Purpose:

- preserve the exact scope sent to the customer
- allow reusable scope language
- support clean PDF export

---

### Financials

```json
{
  "subtotal": 15750.00,
  "taxable": false,
  "tax_rate": 0.00,
  "tax_total": 0.00,
  "discount_total": 0.00,
  "proposal_total": 15750.00,
  "pricing_type": "fixed_price",
  "deposit_required": false,
  "deposit_amount": 0.00
}
```

Suggested `pricing_type` values:

- fixed_price
- time_and_material
- square_foot
- day_rate
- subcontract
- internal

---

### Terms / Notes

```json
{
  "payment_terms": "Due upon completion unless otherwise stated.",
  "warranty_notes": "Warranty terms must be written into the final customer-facing proposal when required.",
  "customer_notes": "Lift supplied by GC.",
  "private_notes": "Internal pricing notes stay private and must not appear on exported PDFs."
}
```

Purpose:

- separate customer-facing terms from private business notes
- prevent internal pricing details from leaking into proposals

---

### Output / Document Links

```json
{
  "html_file": "",
  "pdf_file": "",
  "export_folder": "exports/proposals/2026/",
  "last_exported_at": ""
}
```

Purpose:

- support the existing Scriptable / HTML / PDF workflow
- make exported proposal files easy to find

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

## Full Example Proposal Record

```json
{
  "proposal_id": "PROP-2026-0001",
  "proposal_number": "SGX-PROP-2026-0001",
  "proposal_title": "Canton Car Wash Brick Coating",
  "status": "sent",
  "revision_number": 0,

  "links": {
    "job_id": "JOB-2026-0001",
    "customer_id": "CUST-2026-0001",
    "invoice_id": ""
  },

  "dates": {
    "created_date": "2026-07-01",
    "sent_date": "2026-07-01",
    "revised_date": "",
    "approved_date": "",
    "declined_date": "",
    "expiration_date": "2026-07-31",
    "converted_to_invoice_date": ""
  },

  "scope": {
    "scope_intro": "Spray GenX LLC proposes to complete the following work:",
    "scope_items": [
      {
        "item_id": "ITEM-001",
        "description": "Prepare and coat exterior brick masonry surfaces with two coats of Sherwin-Williams Loxon XP.",
        "quantity": 1,
        "unit": "lump_sum",
        "unit_price": 15750.00,
        "line_total": 15750.00
      }
    ],
    "included_work": [
      "Surface preparation as required for coating application",
      "Two finish coats as specified"
    ],
    "excluded_work": [
      "Lift rental supplied by others unless otherwise stated",
      "Material supplied by others unless otherwise stated"
    ]
  },

  "financials": {
    "subtotal": 15750.00,
    "taxable": false,
    "tax_rate": 0.00,
    "tax_total": 0.00,
    "discount_total": 0.00,
    "proposal_total": 15750.00,
    "pricing_type": "fixed_price",
    "deposit_required": false,
    "deposit_amount": 0.00
  },

  "terms": {
    "payment_terms": "Due upon completion unless otherwise stated.",
    "warranty_notes": "Warranty terms must be written into the final customer-facing proposal when required.",
    "customer_notes": "Lift supplied by GC.",
    "private_notes": "Internal notes stay private."
  },

  "output": {
    "html_file": "",
    "pdf_file": "",
    "export_folder": "exports/proposals/2026/",
    "last_exported_at": ""
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

## Convert Proposal to Invoice Rule

When a proposal is approved:

- keep the original proposal record
- set proposal `status` to `converted_to_invoice` only after invoice creation
- create a new invoice record with a new `INV-YYYY-0001` ID
- copy customer-facing scope and financial totals into the invoice
- link the invoice ID back to the proposal, job, and customer records
- do not overwrite the approved proposal history
