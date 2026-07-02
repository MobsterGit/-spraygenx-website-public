# Spray GenX Manager Data

This folder is the lightweight owner-side manager-system structure.

## Structure

```text
data/manager/
  jobs/
  customers/
  proposals/
  invoices/
  mileage/
  media/
  tasks/
  templates/
  imports/
  exports/
    jobs/
    customers/
    proposals/
    invoices/
    mileage/
    tax/
  archive/
    2026/
```

## Rule

Manager records may contain private business data. They do not automatically publish to the public website.

Public portfolio content still lives in:

```text
data/portfolio.json
```

Approved portfolio projects should be copied intentionally from manager media records into `data/portfolio.json`.

## Import Staging

Existing Scriptable proposal and invoice records should be staged in:

```text
data/manager/imports/
```

This keeps the live Scriptable Proposal / Invoice Manager intact while the website Manager learns how to index those records, create matching jobs/customers, and connect proposals, invoices, tasks, photos, and mileage.

See `data/manager/imports/README.md` for the import rules.
