# Spray GenX Manager System — Backup and Recovery

This file defines the backup rules for the owner-side Manager system, especially proposals, invoices, jobs, and indexes.

## Core Rule

No save operation should be treated as safe until the previous known-good record is recoverable.

The Manager should protect against:

- a bad edit to one proposal or invoice
- a broken `manager-index.json` or `document_index.json`
- accidental deletion
- partial sync from iCloud / Scriptable
- bulk corruption of accepted proposals, paid invoices, or archived records

## Backup Folder Convention

```text
data/manager/backups/
  YYYY/
    MM/
      daily/
        YYYY-MM-DD-manager-index.json
        YYYY-MM-DD-document-index.json
        YYYY-MM-DD-active-records.json
      records/
        proposals/
        invoices/
        jobs/
        customers/
        media/
        mileage/
        tasks/
      full-exports/
        YYYY-MM-DD-spraygenx-manager-export.json
```

## Safe-Write Process

Every future Scriptable or Manager save should follow this order:

1. Read the active file.
2. Save the current active file into `backups/YYYY/MM/records/<record-type>/`.
3. Write the new file to a temporary path or temporary object.
4. Verify the new JSON parses.
5. Confirm required IDs still exist.
6. Replace the active file only after validation passes.
7. Update `manager-index.json` and `document_index.json`.
8. Snapshot the affected index files.

## Daily Snapshot

At least once per day, snapshot:

- `data/manager/manager-index.json`
- `data/manager/document_index.json`
- all active jobs
- all active proposals
- all open invoices

History records should not need daily duplication once archived, but they must be included in full exports.

## Full Export

A full export should capture one dated JSON package containing:

- all manager records
- document index
- manager index
- settings/templates
- import log
- backup metadata

This is the iPhone-friendly equivalent of a ZIP backup until a true ZIP export is added.

## Recovery View Requirements

The recovery screen should allow the owner to:

- pick record type
- pick record number
- view current version and previous backup version
- restore last known good JSON
- rebuild indexes from record folders
- copy recovery JSON if automatic restore fails

## Record Metadata

Critical records should eventually include:

```json
{
  "audit": {
    "version": 1,
    "created_at": "YYYY-MM-DDTHH:mm:ssZ",
    "updated_at": "YYYY-MM-DDTHH:mm:ssZ",
    "last_backup_at": "YYYY-MM-DDTHH:mm:ssZ",
    "checksum": "future-checksum"
  }
}
```

## Scriptable Requirement

Backup and recovery must work from iPhone / Scriptable, not only from desktop. Scriptable writes should use the same safe-write concept before updating GitHub data.
