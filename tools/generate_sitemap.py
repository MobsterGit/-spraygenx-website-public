#!/usr/bin/env python3
"""Generate sitemap.xml from indexable HTML files in the repository."""

from __future__ import annotations

import datetime as dt
import re
import subprocess
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import urlsplit, urlunsplit
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET

BASE_URL = "https://spraygenx.com"
SITE_HOSTS = {"spraygenx.com", "www.spraygenx.com"}
MIN_URLS = 8

EXCLUDED_DIRECTORIES = {
    ".git",
    ".github",
    "archive",
    "dev",
    "manager",
    "node_modules",
    "scriptable",
    "tools",
    "vendor",
}

EXCLUDED_FILES = {
    "404.html",
    "admin.html",
    "spacing-ab.html",
    "studio.html",
}

# Dynamic pages whose visible content is stored outside their HTML shell.
EXPLICIT_DEPENDENCIES = {
    "gallery.html": ["data/portfolio.json"],
    "photo-library.html": ["data/image-library.json"],
    "regional-updates.html": ["data/regional-updates"],
}

DATA_REFERENCE_RE = re.compile(
    r"(?P<path>data/[A-Za-z0-9_.\-/]+\.(?:json|xml|csv))",
    re.IGNORECASE,
)


class PageMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.canonical: str | None = None
        self.noindex = False
        self.refresh = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()

        if tag == "link":
            rel_tokens = {token.lower() for token in attributes.get("rel", "").split()}
            if "canonical" in rel_tokens and attributes.get("href"):
                self.canonical = attributes["href"].strip()

        if tag == "meta":
            name = attributes.get("name", "").lower()
            content = attributes.get("content", "").lower()
            if name in {"robots", "googlebot"} and "noindex" in content:
                self.noindex = True
            if attributes.get("http-equiv", "").lower() == "refresh":
                self.refresh = True


@dataclass(frozen=True)
class Candidate:
    source: Path
    url: str
    self_canonical: bool
    dependencies: tuple[str, ...]


def repository_root() -> Path:
    return Path(__file__).resolve().parents[1]


def excluded_path(relative: Path) -> bool:
    if relative.name.lower() in EXCLUDED_FILES:
        return True
    return any(part.lower() in EXCLUDED_DIRECTORIES for part in relative.parts[:-1])


def derived_url(relative: Path) -> str:
    posix = relative.as_posix()
    if posix == "index.html":
        path = "/"
    elif posix.endswith("/index.html"):
        path = "/" + posix[: -len("index.html")]
    else:
        path = "/" + posix
    return BASE_URL + path


def normalize_canonical(raw_url: str) -> str | None:
    parsed = urlsplit(raw_url.strip())
    if not parsed.scheme and not parsed.netloc:
        path = parsed.path if parsed.path.startswith("/") else "/" + parsed.path
        parsed = urlsplit(BASE_URL + path)
    if parsed.scheme.lower() not in {"http", "https"}:
        return None
    if parsed.netloc.lower() not in SITE_HOSTS:
        return None
    path = parsed.path or "/"
    return urlunsplit(("https", "spraygenx.com", path, "", ""))


def discover_candidates(root: Path) -> tuple[list[Candidate], list[str]]:
    candidates: list[Candidate] = []
    notes: list[str] = []

    for html_file in sorted(root.rglob("*.html")):
        relative = html_file.relative_to(root)
        if excluded_path(relative):
            notes.append(f"exclude path: {relative.as_posix()}")
            continue

        try:
            text = html_file.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            raise RuntimeError(f"Unable to read {relative}: {exc}") from exc

        parser = PageMetadataParser()
        parser.feed(text)
        if parser.noindex:
            notes.append(f"exclude noindex: {relative.as_posix()}")
            continue
        if parser.refresh:
            notes.append(f"exclude refresh: {relative.as_posix()}")
            continue

        generated = derived_url(relative)
        canonical = normalize_canonical(parser.canonical) if parser.canonical else generated
        if parser.canonical and canonical is None:
            notes.append(f"exclude external/invalid canonical: {relative.as_posix()}")
            continue

        dependencies = set(EXPLICIT_DEPENDENCIES.get(relative.as_posix(), []))
        for match in DATA_REFERENCE_RE.finditer(text):
            dependencies.add(match.group("path"))

        candidates.append(
            Candidate(
                source=relative,
                url=canonical,
                self_canonical=(canonical == generated),
                dependencies=tuple(sorted(dependencies)),
            )
        )

    return candidates, notes


def deduplicate(candidates: Iterable[Candidate]) -> list[Candidate]:
    selected: dict[str, Candidate] = {}
    for candidate in candidates:
        existing = selected.get(candidate.url)
        if existing is None or (candidate.self_canonical and not existing.self_canonical):
            selected[candidate.url] = candidate
    return sorted(selected.values(), key=lambda item: (item.url != BASE_URL + "/", item.url))


def git_last_modified(root: Path, paths: Iterable[str]) -> str:
    path_list = [path for path in paths if path]
    command = ["git", "log", "-1", "--format=%cs", "--", *path_list]
    result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
    value = result.stdout.strip()
    if result.returncode == 0 and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    return dt.date.today().isoformat()


def render(entries: list[tuple[str, str]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, lastmod in entries:
        lines.extend(
            [
                "  <url>",
                f"    <loc>{escape(url)}</loc>",
                f"    <lastmod>{lastmod}</lastmod>",
                "  </url>",
            ]
        )
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def validate(xml_text: str, urls: list[str]) -> None:
    root = ET.fromstring(xml_text)
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    found = [element.text or "" for element in root.findall(f"{namespace}url/{namespace}loc")]
    if found != urls:
        raise RuntimeError("Generated sitemap validation failed: URL order/content mismatch")
    if len(found) < MIN_URLS:
        raise RuntimeError(
            f"Refusing to write sitemap with only {len(found)} URLs; expected at least {MIN_URLS}"
        )
    if BASE_URL + "/" not in found:
        raise RuntimeError("Refusing to write sitemap without the homepage")


def main() -> int:
    root = repository_root()
    output = root / "sitemap.xml"
    candidates, notes = discover_candidates(root)
    pages = deduplicate(candidates)

    entries: list[tuple[str, str]] = []
    for page in pages:
        paths = [page.source.as_posix(), *page.dependencies]
        entries.append((page.url, git_last_modified(root, paths)))

    xml_text = render(entries)
    validate(xml_text, [url for url, _ in entries])

    previous = output.read_text(encoding="utf-8") if output.exists() else ""
    if previous == xml_text:
        print(f"Sitemap already current: {len(entries)} canonical URLs")
    else:
        output.write_text(xml_text, encoding="utf-8")
        print(f"Updated sitemap.xml with {len(entries)} canonical URLs")

    for page in pages:
        print(f"include {page.url} <- {page.source.as_posix()}")
    for note in notes:
        print(note, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
