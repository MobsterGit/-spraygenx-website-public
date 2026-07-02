# Spray GenX Manager System — Invoice Record Structure

The Invoice record tracks billable work after a proposal is approved or after work becomes ready to bill.

## Invoice ID Rule

Every invoice gets one permanent ID.

Recommended format:

```text
INV-YYYY-0001
```

Examples:

```text
INV-2026-0001
INV-2026-0002
INV-2026-0003
```

The invoice ID should never change, even if the invoice is revised, partially paid, paid, overdue, or voided.

## Invoice Record Purpose

The record exists to answer these questions quickly:

- Which job, customer, and proposal is this invoice connected to?
- What work is being billed?
- How much is owed?
- Has it been sent?
- Has it been paid?
- Is anything overdue?
- Where is the exported PDF or customer-facing invoice file?

---

## Core Invoice Fields

### Identity

```json
{
  "invoice_id": "INV-2026-0001",
  "invoice_number": "SGX-INV-2026-0001",
  "invoice_title": "Canton Car Wash Brick Coating",
  "status": "draft"
}
```

Required fields:

- `invoice_id`
- `invoice_number`
- `invoice_title`
- `status`

Suggested `status` values:

- draft
- sent
- partially_paid
- paid
- overdue
- void
- archived

---

### Linked Records

```json
{
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "proposal_id": "PROP-2026-0001"
}
```

Purpose:

- connect invoice to the job record
- pull customer billing details from the customer / contractor record
- preserve the proposal-to-invoice chain

---

### Dates

```json
{
  "created_date": "2026-07-01",
  "sent_date": "",
  "due_date": "",
  "paid_date": "",
  "void_date": ""
}
```

Purpose:

- support collections and follow-ups
- support accounting exports
- support overdue invoice tracking

---

### Billable Items

```json
{
  "line_items": [
    {
      "item_id": "ITEM-001",
      "description": "Prepare and coat exterior brick masonry surfaces with two coats of Sherwin-Williams Loxon XP.",
      "quantity": 1,
      "unit": "lump_sum",
      "unit_price": 15750.00,
      "line_total": 15750.00
    }
  ]
}
```

Purpose:

- preserve exactly what is being billed
- allow invoice totals to be calculated consistently
- support PDF export

---

### Financials / Payment Status

```json
{
  "subtotal": 15750.00,
  "taxable": false,
  "tax_rate": 0.00,
  "tax_total": 0.00,
  "discount_total": 0.00,
  "invoice_total": 15750.00,
  "amount_paid": 0.00,
  "balance_due": 15750.00,
  "payment_status": "unpaid"
}
```

Suggested `payment_status` values:

- unpaid
- partially_paid
- paid
- overdue
- void

---

### Payments

```json
{
  "payments": [
    {
      "payment_id": "PAY-2026-0001",
      "payment_date": "",
      "amount": 0.00,
      "method": "",
      "reference": "",
      "notes": ""
    }
  ]
}
```

Suggested `method` values:

- cash
- check
- credit_card
- bank_transfer
- zelle
- quickbooks
- other

Purpose:

- support partial payments
- preserve payment history
- make year-end reconciliation easier

---

### Terms / Notes

```json
{
  "payment_terms": "Due upon completion unless otherwise stated.",
  "customer_notes": "Thank you for your business.",
  "private_notes": "Internal collection notes stay private."
}
```

Purpose:

- keep customer-facing language separate from private collection notes
- support clean invoice PDFs

---

### Output / Document Links

```json
{
  "html_file": "",
  "pdf_file": "",
  "export_folder": "exports/invoices/2026/",
  "last_exported_at": ""
}
```

Purpose:

- support the existing Scriptable / HTML / PDF workflow
- make exported invoice files easy to find

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

## Full Example Invoice Record

```json
{
  "invoice_id": "INV-2026-0001",
  "invoice_number": "SGX-INV-2026-0001",
  "invoice_title": "Canton Car Wash Brick Coating",
  "status": "sent",

  "links": {
    "job_id": "JOB-2026-0001",
    "customer_id": "CUST-2026-0001",
    "proposal_id": "PROP-2026-0001"
  },

  "dates": {
    "created_date": "2026-07-01",
    "sent_date": "2026-07-01",
    "due_date": "2026-07-01",
    "paid_date": "",
    "void_date": ""
  },

  "billable_items": {
    "line_items": [
      {
        "item_id": "ITEM-001",
        "description": "Prepare and coat exterior brick masonry surfaces with two coats of Sherwin-Williams Loxon XP.",
        "quantity": 1,
        "unit": "lump_sum",
        "unit_price": 15750.00,
        "line_total": 15750.00
      }
    ]
  },

  "financials": {
    "subtotal": 15750.00,
    "taxable": false,
    "tax_rate": 0.00,
    "tax_total": 0.00,
    "discount_total": 0.00,
    "invoice_total": 15750.00,
    "amount_paid": 0.00,
    "balance_due": 15750.00,
    "payment_status": "unpaid"
  },

  "payments": [],

  "terms": {
    "payment_terms": "Due upon completion unless otherwise stated.",
    "customer_notes": "Thank you for your business.",
    "private_notes": "Internal collection notes stay private."
  },

  "output": {
    "html_file": "",
    "pdf_file": "",
    "export_folder": "exports/invoices/2026/",
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

## Invoice Update Rule

When an invoice changes:

- do not change the invoice ID
- update `status`, `amount_paid`, `balance_due`, and `payment_status`
- add payment records instead of overwriting payment history
- void invoices instead of deleting business records
- keep private collection notes out of customer-facing exports
