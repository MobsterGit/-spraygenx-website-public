# Spray GenX Manager Data

This folder is the first lightweight owner-side manager-system structure.

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
