# Sprint 1 — Upload Engine

## Objective

Build the first working Project Manager upload engine on the `develop` branch.

The user flow is intentionally simple:

1. Select photos.
2. Review thumbnails.
3. Pick the cover photo.
4. Publish a development preview.

## Sprint Rules

- Never ask the user to do something the computer can safely do automatically.
- The original upload is never modified.
- Cancel is not an error.
- Development work stays on `develop` until reviewed.

## Checklist

### Foundation

- [x] Create Project Manager module folder.
- [x] Add configuration file.
- [x] Add logger.
- [x] Add image processor.
- [x] Add upload engine.
- [x] Add Project Manager UI shell.

### Upload Interface

- [x] Mobile file picker.
- [x] Desktop drag-and-drop.
- [x] Multiple image selection.
- [x] 10-photo limit.
- [x] Cancel without error.
- [x] Back button.

### Image Processing

- [x] Browser image decode validation.
- [x] JPEG rendering.
- [x] Thumbnail rendering.
- [x] Duplicate filename protection.
- [x] Corrupt/unreadable image rejection.
- [ ] Dedicated HEIC fallback for browsers that cannot decode HEIC.
- [ ] WebP output option.

### Cover Photo

- [x] Auto-select first accepted photo as default cover.
- [x] One-click cover photo selection.
- [x] Only one cover photo allowed.
- [x] Cover stored in development payload.

### Logging

- [x] Session log.
- [x] Rejected image logging.
- [x] Processing log entries.
- [ ] Persistent log file export.

### Publish

- [x] Development preview payload.
- [ ] Write project metadata to data store.
- [ ] Save processed image files.
- [ ] Wire preview into portfolio page.

## Test Plan

- [ ] Select 1 photo.
- [ ] Select 5 photos.
- [ ] Select 10 photos.
- [ ] Select more than 10 photos.
- [ ] Cancel the picker.
- [ ] Use Back without losing selected photos.
- [ ] Delete selected photo.
- [ ] Change cover photo.
- [ ] Try duplicate filenames.
- [ ] Try unreadable/corrupt image.
- [ ] Test on iPhone.
- [ ] Test on desktop.
