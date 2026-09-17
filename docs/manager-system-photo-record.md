# Spray GenX Manager System — Photo Record Structure

The photo record organizes job image groups before selected images are used on the website.

## ID Rule

Use one stable ID per photo group:

```text
PHOTO-YYYY-0001
```

Example:

```json
{
  "photo_group_id": "PHOTO-2026-0001",
  "title": "Canton Car Wash Brick Coating",
  "status": "inbox",
  "visibility": "private"
}
```

## Linked Records

```json
{
  "job_id": "JOB-2026-0001",
  "customer_id": "CUST-2026-0001",
  "proposal_id": "PROP-2026-0001",
  "invoice_id": "",
  "portfolio_project_id": ""
}
```

## Folders

```json
{
  "source_folder": "images/jobs/JOB-2026-0001/source/",
  "archive_folder": "images/jobs/JOB-2026-0001/archive/",
  "portfolio_folder": "images/portfolio/block-metal/canton-car-wash/",
  "cover_file": ""
}
```

## Image List

```json
{
  "images": [
    {
      "image_id": "IMG-001",
      "original_filename": "IMG_1234.jpeg",
      "current_filename": "canton-car-wash-before-01.jpeg",
      "role": "before",
      "status": "portfolio_candidate",
      "caption": "Before coating work began.",
      "alt_text": "Commercial brick exterior before coating work",
      "approved_for_website": false
    }
  ]
}
```

Suggested image roles:

- before
- during
- after
- detail
- cover
- wide
- closeup
- material
- rejected

Suggested statuses:

- inbox
- needs_review
- job_archive
- portfolio_candidate
- approved_for_website
- published
- hidden
- rejected

## Portfolio Fields

```json
{
  "portfolio_candidate": true,
  "portfolio_approved": false,
  "portfolio_published": false,
  "portfolio_category": "block-metal",
  "portfolio_title": "Car Wash Masonry Coating",
  "portfolio_description": "Durable water-resistant masonry coating for a commercial car wash exterior.",
  "portfolio_slug": "car-wash-masonry-coating",
  "publish_to": "data/portfolio.json"
}
```

## Rule

Keep job archive photos separate from public portfolio content. Only approved website images should be mapped into `data/portfolio.json`.
