# Spray GenX Manager System — Customer / Contractor Record Structure

The Customer / Contractor record stores repeat contacts once so jobs, proposals, invoices, follow-ups, and reports can reuse the same information without retyping it.

## Customer ID Rule

Every contact gets one permanent ID.

Recommended format:

```text
CUST-YYYY-0001
```

Examples:

```text
CUST-2026-0001
CUST-2026-0002
CUST-2026-0003
```

The customer ID should never change, even if the company name, contact person, phone number, or billing address changes later.

## Customer / Contractor Record Purpose

The record exists to answer these questions quickly:

- Who is the customer, contractor, supplier, or business relationship?
- What type of contact is it?
- Who is the main person to call, text, or email?
- Where should proposals and invoices be sent?
- Is the billing address different from the job site?
- What jobs are connected to this contact?
- Are there open proposals, unpaid invoices, or follow-up tasks?
- Are there private relationship notes that should not go on customer-facing documents?

---

## Core Customer / Contractor Fields

### Identity

```json
{
  "customer_id": "CUST-2026-0001",
  "display_name": "Example General Contractor",
  "company_name": "Example General Contractor LLC",
  "primary_contact_name": "John Smith",
  "contact_type": "general_contractor",
  "status": "active"
}
```

Required fields:

- `customer_id`
- `display_name`
- `contact_type`
- `status`

Suggested `contact_type` values:

- homeowner
- business_owner
- general_contractor
- property_manager
- subcontract_relationship
- supplier_vendor
- internal

Suggested `status` values:

- lead
- active
- repeat_customer
- inactive
- archived
- do_not_use

---

### Contact Information

```json
{
  "phone_primary": "",
  "phone_secondary": "",
  "email_primary": "",
  "email_secondary": "",
  "preferred_contact_method": "text",
  "best_time_to_contact": ""
}
```

Suggested `preferred_contact_method` values:

- call
- text
- email
- in_person
- no_preference

Purpose:

- keep communication information in one place
- support proposal and invoice delivery
- reduce hunting through text messages and old documents

---

### Billing Address

```json
{
  "billing_name": "Example General Contractor LLC",
  "address_line_1": "",
  "address_line_2": "",
  "city": "",
  "state": "OH",
  "zip": "",
  "county": "",
  "tax_exempt": false,
  "tax_exempt_certificate_on_file": false
}
```

Purpose:

- support proposals and invoices
- keep billing details separate from job-site addresses
- support tax-exempt customer handling

---

### Relationship / Business Details

```json
{
  "relationship_type": "direct_customer",
  "source": "referral",
  "default_pricing_type": "fixed_price",
  "payment_terms": "due_on_receipt",
  "requires_po_number": false,
  "requires_w9": false,
  "requires_insurance_certificate": false
}
```

Suggested `relationship_type` values:

- direct_customer
- general_contractor
- subcontract_client
- property_management
- supplier_vendor
- internal

Suggested `default_pricing_type` values:

- fixed_price
- time_and_material
- square_foot
- day_rate
- subcontract
- internal

Suggested `payment_terms` values:

- due_on_receipt
- due_on_completion
- net_7
- net_15
- net_30
- custom

---

### Linked Records

```json
{
  "job_ids": [
    "JOB-2026-0001"
  ],
  "proposal_ids": [
    "PROP-2026-0001"
  ],
  "invoice_ids": [
    "INV-2026-0001"
  ],
  "task_ids": [
    "TASK-2026-0001"
  ],
  "mileage_ids": [],
  "photo_group_ids": []
}
```

Purpose:

- make repeat-customer history visible
- connect proposals, invoices, jobs, photos, mileage, and follow-ups back to one contact
- support future reports by customer, contractor, or relationship type

---

### Financial Summary

```json
{
  "lifetime_estimated_value": 0.00,
  "lifetime_approved_value": 0.00,
  "lifetime_invoiced": 0.00,
  "lifetime_paid": 0.00,
  "current_balance_due": 0.00,
  "open_proposal_count": 0,
  "open_invoice_count": 0
}
```

Purpose:

- show whether the relationship is financially active
- help spot unpaid invoices or valuable repeat customers
- support future customer revenue reports

---

### Follow-Up / Relationship Notes

```json
{
  "next_action": "Follow up on proposal approval.",
  "next_action_due": "2026-07-05",
  "priority": "normal",
  "follow_up_required": true,
  "relationship_notes": "Prefers short text updates before phone calls.",
  "private_notes": "Do not include internal pricing notes on customer-facing documents."
}
```

Suggested `priority` values:

- low
- normal
- high
- urgent

Purpose:

- keep important contact preferences visible
- prevent customer notes from getting mixed with private business notes
- support a simple morning dashboard

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

- support backups and troubleshooting
- preserve record history when contact information changes

---

## Full Example Customer / Contractor Record

```json
{
  "customer_id": "CUST-2026-0001",
  "display_name": "Example General Contractor",
  "company_name": "Example General Contractor LLC",
  "primary_contact_name": "John Smith",
  "contact_type": "general_contractor",
  "status": "active",

  "contact": {
    "phone_primary": "",
    "phone_secondary": "",
    "email_primary": "",
    "email_secondary": "",
    "preferred_contact_method": "text",
    "best_time_to_contact": ""
  },

  "billing_address": {
    "billing_name": "Example General Contractor LLC",
    "address_line_1": "",
    "address_line_2": "",
    "city": "",
    "state": "OH",
    "zip": "",
    "county": "",
    "tax_exempt": false,
    "tax_exempt_certificate_on_file": false
  },

  "business_details": {
    "relationship_type": "general_contractor",
    "source": "referral",
    "default_pricing_type": "fixed_price",
    "payment_terms": "due_on_completion",
    "requires_po_number": false,
    "requires_w9": true,
    "requires_insurance_certificate": true
  },

  "links": {
    "job_ids": [
      "JOB-2026-0001"
    ],
    "proposal_ids": [
      "PROP-2026-0001"
    ],
    "invoice_ids": [],
    "task_ids": [],
    "mileage_ids": [],
    "photo_group_ids": []
  },

  "financials": {
    "lifetime_estimated_value": 15750.00,
    "lifetime_approved_value": 0.00,
    "lifetime_invoiced": 0.00,
    "lifetime_paid": 0.00,
    "current_balance_due": 0.00,
    "open_proposal_count": 1,
    "open_invoice_count": 0
  },

  "follow_up": {
    "next_action": "Follow up on proposal approval.",
    "next_action_due": "2026-07-05",
    "priority": "normal",
    "follow_up_required": true,
    "relationship_notes": "Prefers short text updates before phone calls.",
    "private_notes": "Track insurance certificate expiration before larger GC work."
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

## Implementation Notes

- Jobs should store only the customer link fields needed for quick display.
- Full contact and billing details should live in this customer / contractor record.
- Customer-facing documents should pull billing/contact details from here.
- Private notes should never be exported to proposals, invoices, or portfolio content.
