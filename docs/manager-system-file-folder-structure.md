# Spray GenX Manager System — File and Folder Structure

This document defines the first working file structure for the Spray GenX manager system.

## Decision

Manager data should live under:

```text
data/manager/
```

Reason:

- the website already uses a static data workflow
- JSON files can stay lightweight and easy to edit
- the structure can work from GitHub, Scriptable, or a future local dashboard
- it avoids adding a database before the data model is stable

---

## Proposed Folder Structure

```text
data/
  portfolio.json
  manager/
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

---

## Public vs Business Data

### Public website data

The public website should continue using:

```text
data/portfolio.json
```

Public portfolio data should include only approved project information, selected images, captions, categories, and visible descriptions.

### Manager business data

Business-management files should live under:

```text
data/manager/
```

Manager files may include customer names, billing details, job values, proposals, invoices, mileage, notes, and follow-up tasks.

### Rule

The public site should not automatically publish manager records.

Portfolio publishing must be an intentional step that copies approved project information into `data/portfolio.json`.

---

## Record Folder Rules

### Jobs

```text
data/manager/jobs/JOB-2026-0001.json
```

### Customers / Contractors

```text
data/manager/customers/CUST-2026-0001.json
```

### Proposals

```text
data/manager/proposals/PROP-2026-0001.json
```

### Invoices

```text
data/manager/invoices/INV-2026-0001.json
```

### Mileage

```text
data/manager/mileage/MILE-2026-0001.json
```

### Media / Job Images

```text
data/manager/media/MEDIA-2026-0001.json
```

### Follow-Up Tasks

```text
data/manager/tasks/TASK-2026-0001.json
```

---

## Naming Rules

Use stable IDs for file names.

Recommended formats:

```text
JOB-YYYY-0001.json
CUST-YYYY-0001.json
PROP-YYYY-0001.json
INV-YYYY-0001.json
MILE-YYYY-0001.json
MEDIA-YYYY-0001.json
TASK-YYYY-0001.json
```

Do not rename records just because a customer name, job title, or scope changes.

Readable titles and slugs should live inside the JSON record.

---

## Export Structure

Exports should go under:

```text
data/manager/exports/
```

Initial export targets:

```text
data/manager/exports/jobs/
data/manager/exports/customers/
data/manager/exports/proposals/
data/manager/exports/invoices/
data/manager/exports/mileage/
data/manager/exports/tax/
```

Export files can use readable names such as:

```text
jobs-2026.csv
customers-2026.csv
proposals-2026.csv
invoices-2026.csv
mileage-2026.csv
tax-support-2026.csv
```

---

## Backup / Archive Structure

Yearly archives should go under:

```text
data/manager/archive/2026/
```

Archive folders should preserve records, exports, and final customer-facing documents for the year.

---

## Working Rule for Sprint 2

Build data structure first, then interface.

The first manager MVP should use simple JSON records under `data/manager/` before building any heavier dashboard, database, or app layer.
