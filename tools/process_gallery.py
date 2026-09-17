#!/usr/bin/env python3
"""
Spray GenX gallery processor.

Workflow:
1. Place project folders inside upload-inbox/.
2. Each folder name becomes the project ID.
3. This script copies originals, creates web images, creates thumbnails,
   and writes project.json for each project.

This is intentionally simple and file-based. No database. No CMS.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
UPLOAD_INBOX = ROOT / "upload-inbox"
PROJECT_IMAGES = ROOT / "images" / "projects"
PROJECT_INDEX = ROOT / "projects" / "projects.json"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
WEB_MAX_SIZE = (1800, 1800)
THUMB_MAX_SIZE = (520, 520)
JPEG_QUALITY = 82


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def title_from_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-"))


def iter_images(folder: Path) -> Iterable[Path]:
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path


def save_web_image(source: Path, target: Path, max_size: tuple[int, int]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail(max_size)
        img.save(target, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)


def load_project_index() -> list[dict]:
    if not PROJECT_INDEX.exists():
        return []
    with PROJECT_INDEX.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_project_index(projects: list[dict]) -> None:
    PROJECT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    with PROJECT_INDEX.open("w", encoding="utf-8") as f:
        json.dump(projects, f, indent=2)
        f.write("\n")


def upsert_project(projects: list[dict], project: dict) -> list[dict]:
    existing = {item["id"]: item for item in projects}
    existing[project["id"]] = {**existing.get(project["id"], {}), **project}
    return sorted(existing.values(), key=lambda item: item.get("title", item["id"]))


def process_project_folder(folder: Path) -> dict | None:
    project_id = slugify(folder.name)
    images = list(iter_images(folder))
    if not project_id or not images:
        return None

    project_root = PROJECT_IMAGES / project_id
    originals_dir = project_root / "originals"
    gallery_dir = project_root / "gallery"
    thumbs_dir = project_root / "thumbs"

    originals_dir.mkdir(parents=True, exist_ok=True)
    gallery_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    gallery_items = []

    for index, source in enumerate(images, start=1):
        number = f"{index:02d}"
        original_name = f"{number}{source.suffix.lower()}"
        web_name = f"{number}.jpg"

        shutil.copy2(source, originals_dir / original_name)
        save_web_image(source, gallery_dir / web_name, WEB_MAX_SIZE)
        save_web_image(source, thumbs_dir / web_name, THUMB_MAX_SIZE)

        gallery_items.append(
            {
                "original": f"images/projects/{project_id}/originals/{original_name}",
                "image": f"images/projects/{project_id}/gallery/{web_name}",
                "thumb": f"images/projects/{project_id}/thumbs/{web_name}",
                "caption": "",
            }
        )

    project = {
        "id": project_id,
        "title": title_from_slug(project_id),
        "city": "",
        "state": "OH",
        "category": "",
        "year": "",
        "featured": False,
        "status": "draft",
        "coverImage": gallery_items[0]["image"],
        "thumbImage": gallery_items[0]["thumb"],
        "imageCount": len(gallery_items),
        "gallery": gallery_items,
    }

    with (project_root / "project.json").open("w", encoding="utf-8") as f:
        json.dump(project, f, indent=2)
        f.write("\n")

    return project


def main() -> None:
    UPLOAD_INBOX.mkdir(exist_ok=True)
    PROJECT_IMAGES.mkdir(parents=True, exist_ok=True)

    projects = load_project_index()
    processed = 0

    for folder in sorted(UPLOAD_INBOX.iterdir()):
        if not folder.is_dir():
            continue
        if folder.name.startswith("."):
            continue
        project = process_project_folder(folder)
        if project:
            projects = upsert_project(projects, project)
            processed += 1

    save_project_index(projects)
    print(f"Processed {processed} project folder(s).")


if __name__ == "__main__":
    main()
