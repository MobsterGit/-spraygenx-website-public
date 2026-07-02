# Spray GenX Manager System — Mileage Record Structure

The Mileage record connects business driving to jobs, estimates, suppliers, admin errands, and year-end tax exports.

## Mileage ID Rule

Every mileage entry gets one permanent ID.

Recommended format:

```text
MILE-YYYY-0001
```

Examples:

```text
MILE-2026-0001
MILE-2026-0002
MILE-2026-0003
```

The mileage ID should never change, even if the trip classification, job link, or notes are corrected later.

## Mileage Record Purpose

The record exists to answer these questions quickly:

- When did the trip happen?
- Where did it start and end?
- How many miles were driven?
- Was it business, personal, mixed, or needs review?
- Which job, proposal, invoice, customer, supplier, or errand is it connected to?
- What source created the record?
- Is it ready for tax export?

---

## Core Mileage Fields

### Identity

```json
{
  "mileage_id": "MILE-2026-0001",
  "trip_date": "2026-07-01",
  "status": "needs_review",
  "classification": "business"
}
```

Required fields:

- `mileage_id`
- `trip_date`
- `status`
- `classification`

Suggested `status` values:

- imported
- needs_review
- reviewed
- exported
- archived

Suggested `classification` values:

- business
- personal
- mixed
- commute
- unknown

---

### Trip Details

```json
{
  "origin_name": "Home Office",
  "origin_address": "",
  "destination_name": "Canton Car Wash",
  "destination_address": "",
  "city": "Canton",
  "state": "OH",
  "miles": 0.00,
  "round_trip": false
}
```

Purpose:

- preserve the basic mileage facts
- support job matching and tax export
- keep location labels readable from a phone

---

### Purpose / Category

```json
{
  "purpose": "Estimate / site visit",
  "trip_category": "job_site",
  "business_percent": 100,
  "deductible_miles": 0.00
}
```

Suggested `trip_category` values:

- job_site
- estimate
- supplier
- material_pickup
- admin
- bank
- post_office
- personal
- mixed
- unknown

Purpose:

- reduce year-end sorting
- support accountant-friendly exports
- allow mixed-use trips without losing notes

---

### Linked Records

```json
{
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "proposal_id": "PROP-2026-0001",
  "invoice_id": "",
  "supplier_id": ""
}
```

Purpose:

- connect trips to actual business activity
- support reporting by job and customer
- allow supplier/admin trips that are not tied to one job

---

### Source / Import Notes

```json
{
  "source": "manual",
  "source_file": "",
  "source_row_id": "",
  "confidence": "manual",
  "import_notes": ""
}
```

Suggested `source` values:

- manual
- google_timeline
- csv_import
- bank_match
- receipt_match
- scriptable

Suggested `confidence` values:

- manual
- high
- medium
- low
- unknown

---

### Notes / Audit

```json
{
  "notes": "Site visit for coating proposal.",
  "private_notes": "",
  "created_by": "owner",
  "created_at": "2026-07-01T00:00:00-04:00",
  "updated_at": "2026-07-01T00:00:00-04:00",
  "archived": false
}
```

---

## Full Example Mileage Record

```json
{
  "mileage_id": "MILE-2026-0001",
  "trip_date": "2026-07-01",
  "status": "reviewed",
  "classification": "business",

  "trip": {
    "origin_name": "Home Office",
    "origin_address": "",
    "destination_name": "Canton Car Wash",
    "destination_address": "",
    "city": "Canton",
    "state": "OH",
    "miles": 0.00,
    "round_trip": false
  },

  "purpose": {
    "purpose": "Estimate / site visit",
    "trip_category": "job_site",
    "business_percent": 100,
    "deductible_miles": 0.00
  },

  "links": {
    "job_id": "JOB-2026-0001",
    "customer_id": "CUST-2026-0001",
    "proposal_id": "PROP-2026-0001",
    "invoice_id": "",
    "supplier_id": ""
  },

  "source": {
    "source": "manual",
    "source_file": "",
    "source_row_id": "",
    "confidence": "manual",
    "import_notes": ""
  },

  "notes": {
    "notes": "Site visit for coating proposal.",
    "private_notes": ""
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

## Export Rule

Mileage exports should include one clean row per mileage record with:

- date
- origin
- destination
- miles
- deductible miles
- classification
- purpose
- job ID
- customer ID
- notes
- source

Private notes should not be included in accountant-facing exports unless intentionally selected.
