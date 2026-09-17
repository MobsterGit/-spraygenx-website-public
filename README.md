# Spray GenX Website

Public website for **Spray GenX LLC** — a commercial, residential, and industrial painting and refinishing contractor based in Northeast Ohio with project experience across the United States and the Virgin Islands.

Live site: https://spraygenx.com

## Project Overview

This site is built as a lightweight, file-based portfolio system instead of a traditional CMS.

The goal is simple: keep the website fast, portable, easy to maintain, and centered around real project photography.

## Core Stack

- Static HTML
- CSS
- Vanilla JavaScript
- JSON-driven portfolio data
- GitHub Pages hosting
- Scriptable-based mobile publishing workflow
- GitHub Actions image conversion workflow

## Content Workflow

The portfolio system is designed around field use from an iPhone.

Typical publishing flow:

1. Select project photos on the phone.
2. Upload photos through the Scriptable workflow.
3. Store original uploads in `images/inbox/`.
4. Let GitHub convert uploaded images into web-friendly JPEG files in `images/converted/`.
5. Assign converted images to a project/category block.
6. Update portfolio JSON data.
7. Publish to GitHub.
8. The website reads the updated data and displays the project automatically.

This keeps project updates fast without requiring WordPress, a database, plugins, or repeated manual HTML editing.

## Design Direction

The site is intentionally built around:

- dark navy and Spray GenX blue branding
- strong commercial/industrial presentation
- real project photography
- consistent typography and line height
- reusable cards and portfolio blocks
- mobile-first polish
- full-screen lightbox galleries
- dynamic recent work pulled from portfolio data

## Main Files and Folders

- `index.html` — homepage
- `gallery.html` — portfolio/project gallery
- `services.html` — services page
- `about.html` — company background
- `reviews.html` — customer feedback page
- `contact.html` — contact and estimate page
- `404.html` — custom not-found page
- `brand.css` — primary site styling
- `mobile-polish.css` — final mobile polish overrides
- `brand.js` — shared site behavior
- `icons.svg` — reusable SVG icon set
- `data/` — site and portfolio data files
- `images/` — website images, logos, uploaded photos, and converted project files

## Repository Notes

This repository is public so the website can be served through GitHub Pages and reviewed easily.

Public visitors can view the code, but they cannot modify the repository unless they are explicitly added as collaborators with write access.

## Ownership

All project photos, business copy, branding usage, and site content are for Spray GenX LLC.

Do not reuse project images, business copy, or brand assets without permission from Spray GenX LLC.
