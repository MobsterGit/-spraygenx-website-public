# Dependencies for Scriptable production manager

Source baseline:
`scriptable/SprayGenX-WRA-Manager-GOOD-LAYOUT-DO-NOT-EDIT.js`

Production clone:
`scriptable/production/SprayGenX-WRA-Manager-Production.js`

## Code dependencies

This baseline is self-contained. It does not use separate JavaScript modules, template files, CSS files, or image assets.

It depends on Scriptable built-ins:

- FileManager iCloud
- UITable and UITableRow
- Alert
- QuickLook

## Runtime data folders

The script creates or reads these iCloud folders under Scriptable Documents:

- SprayGenX/Data
- SprayGenX/Logs
- SprayGenX/Proposals
- SprayGenX/Invoices
- SprayGenX/Backups
- SprayGenX/Exports

Key runtime files:

- SprayGenX/Data/settings.json
- SprayGenX/Logs/proposal_index.json
- SprayGenX/Logs/invoice_index.json
- SprayGenX/Logs/activity_log.json

## Safety note

The protected source file should stay frozen. Feature work should happen only in the production clone or a later feature branch.
