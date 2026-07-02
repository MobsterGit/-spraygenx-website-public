# Spray GenX Manager Imports

This folder is the safe staging area for bringing existing Scriptable proposal and invoice records into the Manager.

## Purpose

The current Scriptable Proposal / Invoice Manager should remain the working document engine.

The Manager should import or index those records so they can be connected to:

- jobs
- customers / contractors
- proposals
- invoices
- follow-up tasks
- mileage
- photos
- portfolio projects

## Import Rule

Do not overwrite the live Scriptable workflow.

Use this folder for exported JSON snapshots or batch files first. After the import is verified, records can be copied into the normal Manager folders:

```text
data/manager/proposals/
data/manager/invoices/
data/manager/jobs/
data/manager/customers/
```

## Supported Scriptable Fields

The importer should expect the existing document shape:

```json
{
  "docType": "proposal",
  "docNo": "SGX-2026-024",
  "date": "",
  "client": "",
  "project": "Gazebo Refurbish",
  "price": "$0.00",
  "scope": "",
  "notes": ""
}
```

For invoices, the same basic shape is allowed with `docType` set to `invoice`.

## Manager Mapping

A proposal import should create or update:

- `data/manager/proposals/PROP-YYYY-####.json`
- a matching `JOB-YYYY-####` when no job already exists
- a matching customer record when no customer already exists
- manager index references

An invoice import should create or update:

- `data/manager/invoices/INV-YYYY-####.json`
- proposal link when the matching proposal number exists
- job link when the matching job exists
- manager index references

## Import Safety

- Preserve original `docNo` exactly.
- Do not renumber old proposals.
- Do not delete original Scriptable files.
- Do not publish imported records to the public website.
- Treat imported customer/contact details as private manager data.
