# Spray GenX Manager System — Photo / Portfolio Record Structure

The Photo / Portfolio record manages field photos before any image becomes public website portfolio content.

## Media ID Rule

Every photo group gets one permanent ID.

Recommended format:

```text
MEDIA-YYYY-0001
```

Examples:

```text
MEDIA-2026-0001
MEDIA-2026-0002
MEDIA-2026-0003
```

The media ID should not change if captions, visibility, image filenames, or portfolio status change later.

## Record Purpose

The record exists to answer these questions quickly:

- Which job are these photos connected to?
- Are the photos private archive material or website candidates?
- Which image is the cover?
- Are there before / after pairs?
- Which photos are approved for the public website?
- Which portfolio category and public description should be used?

---

## Core Fields

### Identity

```json
{
  "media_id": "MEDIA-2026-0001",
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "title": "Canton Car Wash Brick Coating Photos",
  "status": "portfolio_candidate"
}
```

Suggested `status` values:

- inbox
- job_archive
- needs_review
- portfolio_candidate
- approved_for_website
- published
- hidden
- rejected
- archived

---

### Image Group

```json
{
  "source_folder": "images/jobs/JOB-2026-0001/",
  "portfolio_folder": "images/portfolio/block-metal/",
  "cover_image": "",
  "before_after_available": false,
  "image_count": 0
}
```

Purpose:

- keep raw/job photos separate from public portfolio photos
- support later image renaming and upload workflows
- avoid accidentally publishing unfinished job photos

---

### Images

```json
{
  "images": [
    {
      "image_id": "IMG-001",
      "source_path": "images/jobs/JOB-2026-0001/photo-001.jpg",
      "portfolio_path": "",
      "type": "progress",
      "caption": "",
      "visible": false,
      "approved_for_website": false,
      "is_cover": false,
      "sort_order": 1
    }
  ]
}
```

Suggested `type` values:

- before
- during
- after
- progress
- detail
- cover
- reference
- rejected

---

### Portfolio Publishing

```json
{
  "portfolio_candidate": true,
  "portfolio_approved": false,
  "portfolio_project_id": "",
  "portfolio_category": "block-metal",
  "portfolio_title": "Car Wash Masonry Coating",
  "portfolio_description": "Durable water-resistant masonry coating for a commercial car wash exterior.",
  "portfolio_visible": false,
  "published_date": ""
}
```

Purpose:

- prepare selected job photos for `data/portfolio.json`
- keep manager records private until a deliberate publish step
- preserve the public-facing title, description, category, image paths, captions, and visibility

---

### Before / After Groups

```json
{
  "before_after_groups": [
    {
      "group_id": "BA-001",
      "label": "Front elevation",
      "before_image_id": "IMG-001",
      "after_image_id": "IMG-002",
      "caption": "Before and after exterior coating transformation."
    }
  ]
}
```

---

### Notes / Audit

```json
{
  "field_notes": "Photos need review before portfolio use.",
  "private_notes": "Do not publish customer-sensitive images.",
  "created_by": "owner",
  "created_at": "2026-07-02T00:00:00-04:00",
  "updated_at": "2026-07-02T00:00:00-04:00",
  "archived": false
}
```

---

## Full Example Photo / Portfolio Record

```json
{
  "media_id": "MEDIA-2026-0001",
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "title": "Canton Car Wash Brick Coating Photos",
  "status": "portfolio_candidate",

  "group": {
    "source_folder": "images/jobs/JOB-2026-0001/",
    "portfolio_folder": "images/portfolio/block-metal/",
    "cover_image": "",
    "before_after_available": false,
    "image_count": 0
  },

  "images": [],

  "portfolio": {
    "portfolio_candidate": true,
    "portfolio_approved": false,
    "portfolio_project_id": "",
    "portfolio_category": "block-metal",
    "portfolio_title": "Car Wash Masonry Coating",
    "portfolio_description": "Durable water-resistant masonry coating for a commercial car wash exterior.",
    "portfolio_visible": false,
    "published_date": ""
  },

  "before_after_groups": [],

  "notes": {
    "field_notes": "Photos need review before portfolio use.",
    "private_notes": "Do not publish customer-sensitive images."
  },

  "audit": {
    "created_by": "owner",
    "created_at": "2026-07-02T00:00:00-04:00",
    "updated_at": "2026-07-02T00:00:00-04:00",
    "archived": false,
    "archive_reason": ""
  }
}
```

---

## Publish Rule

A media record does not publish itself. Public portfolio publishing happens only when approved image paths and public copy are intentionally written into `data/portfolio.json`.
