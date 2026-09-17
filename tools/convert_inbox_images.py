#!/usr/bin/env python3
"""Convert Spray GenX inbox images into web-ready JPEG files.

Input folder:
  images/inbox/

Output folder:
  images/converted/

Supported input:
  HEIC, HEIF, JPG, JPEG, PNG, WEBP, TIFF, TIF, BMP, GIF

The script creates/updates:
  data/converted-images.json
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "images" / "inbox"
OUT = ROOT / "images" / "converted"
MANIFEST = ROOT / "data" / "converted-images.json"
SUPPORTED = {".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp", ".gif"}
MAX_SIDE = 2200
QUALITY = 86


def slug(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value[:80] or "image"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest() -> dict[str, Any]:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"version": 1, "updated": None, "images": []}


def save_manifest(data: dict[str, Any]) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    data["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    MANIFEST.write_text(json.dumps(data, indent=2) + "\n")


def web_path(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def convert_image(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if getattr(im, "is_animated", False):
            im.seek(0)
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)


def main() -> int:
    INBOX.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    images = manifest.setdefault("images", [])
    seen_hashes = {item.get("sha256") for item in images if item.get("sha256")}
    created = 0
    skipped = 0

    for src in sorted(INBOX.rglob("*")):
        if not src.is_file() or src.suffix.lower() not in SUPPORTED:
            continue
        digest = sha256(src)
        if digest in seen_hashes:
            skipped += 1
            continue
        rel_parent = src.relative_to(INBOX).parent
        out_dir = OUT / rel_parent
        name = f"{slug(src.stem)}-{digest[:10]}.jpg"
        dst = out_dir / name
        convert_image(src, dst)
        images.append(
            {
                "source": web_path(src),
                "converted": web_path(dst),
                "sha256": digest,
                "source_ext": src.suffix.lower().lstrip("."),
                "converted_ext": "jpg",
                "converted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "status": "converted",
            }
        )
        seen_hashes.add(digest)
        created += 1
        print(f"Converted: {web_path(src)} -> {web_path(dst)}")

    save_manifest(manifest)
    print(f"Done. Converted {created}. Skipped {skipped} duplicate/already converted file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
