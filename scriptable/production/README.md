# Scriptable Production

Production-safe Scriptable files for Spray GenX.

## Current baseline

- `SprayGenX-WRA-Manager-Production.js` is a clone of `scriptable/SprayGenX-WRA-Manager-GOOD-LAYOUT-DO-NOT-EDIT.js`.
- The protected layout file should remain untouched.
- The cloned production file currently has no external JavaScript dependencies. It uses Scriptable APIs and the SprayGenX iCloud folders it creates/reads at runtime.

## Runtime folders used by the manager

Inside Scriptable iCloud Documents:

- `SprayGenX/Data`
- `SprayGenX/Logs`
- `SprayGenX/Proposals`
- `SprayGenX/Invoices`
- `SprayGenX/Backups`
- `SprayGenX/Exports`

Do not run database cleanup/migration from a new patch until a backup is confirmed.
