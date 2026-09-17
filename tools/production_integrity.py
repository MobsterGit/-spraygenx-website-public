#!/usr/bin/env python3
"""Fail closed when a proposed production tree violates repository policy."""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / ".github" / "production-protection.json"
ZERO_SHA = "0" * 40
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".tif", ".tiff", ".heic", ".heif"}


def git(*args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, text=True, capture_output=True, check=False
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout


def load_policy() -> dict:
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def tree_paths(revision: str) -> set[str]:
    output = git("ls-tree", "-r", "--name-only", revision)
    return {line for line in output.splitlines() if line}


def changed_paths(base: str, head: str) -> list[tuple[str, str]]:
    output = git("diff", "--name-status", "--find-renames", base, head)
    changes: list[tuple[str, str]] = []
    for line in output.splitlines():
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R") or status.startswith("C"):
            changes.append((status[0], parts[-1]))
        elif len(parts) >= 2:
            changes.append((status[0], parts[1]))
    return changes


def path_matches(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return fnmatch.fnmatchcase(path, pattern)


def branch_scope(policy: dict, branch: str) -> list[str] | None:
    for scope in policy["branch_scopes"]:
        if any(fnmatch.fnmatchcase(branch, pattern) for pattern in scope["branches"]):
            return scope["allowed_paths"]
    return None


def git_object_exists(revision: str, path: str, expected_type: str) -> bool:
    result = subprocess.run(
        ["git", "cat-file", "-t", f"{revision}:{path}"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return result.returncode == 0 and result.stdout.strip() == expected_type


def gps_present(path: Path) -> bool:
    try:
        from PIL import Image
        try:
            import pillow_heif

            pillow_heif.register_heif_opener()
        except ImportError:
            pass

        with Image.open(path) as image:
            exif = image.getexif()
            if not exif:
                return False
            gps = exif.get_ifd(34853)
            return bool(gps and (2 in gps or 4 in gps))
    except Exception as exc:
        raise RuntimeError(f"unable to inspect image metadata for {path}: {exc}") from exc


def check(base: str, head: str, branch: str | None, skip_scope: bool) -> list[str]:
    policy = load_policy()
    failures: list[str] = []

    if base == ZERO_SHA:
        return ["base revision is the zero SHA; refusing to validate without a real base tree"]

    base_files = tree_paths(base)
    head_files = tree_paths(head)
    changes = changed_paths(base, head)
    deleted = sorted(base_files - head_files)
    added = sorted(head_files - base_files)
    reduction = len(base_files) - len(head_files)
    reduction_percent = (reduction / len(base_files) * 100.0) if base_files else 100.0

    print(f"Base: {base} ({len(base_files)} files)")
    print(f"Head: {head} ({len(head_files)} files)")
    print(
        f"Tree delta: {len(added)} added, {len(deleted)} deleted, "
        f"file-count change {len(head_files) - len(base_files):+d}"
    )

    maximum_deletions = int(policy["maximum_deletions"])
    if len(deleted) > maximum_deletions:
        failures.append(
            f"unexpected deletions: {len(deleted)} exceeds allowed {maximum_deletions}: "
            + ", ".join(deleted[:20])
        )
    if len(deleted) >= int(policy["large_deletion_count"]):
        failures.append(f"mass deletion threshold reached: {len(deleted)} files")
    if reduction > 0 and reduction_percent >= float(policy["large_file_reduction_percent"]):
        failures.append(
            f"repository file count reduced by {reduction_percent:.2f}% "
            f"({len(base_files)} to {len(head_files)})"
        )

    for path in policy["critical_files"]:
        if not git_object_exists(head, path, "blob"):
            failures.append(f"critical production file is missing: {path}")
    for path in policy["critical_directories"]:
        if not git_object_exists(head, path, "tree"):
            failures.append(f"critical production directory is missing: {path}")

    if not skip_scope:
        if not branch:
            failures.append("branch scope is required for pull-request validation")
        else:
            allowed = branch_scope(policy, branch)
            if allowed is None:
                failures.append(
                    f"branch '{branch}' has no approved path scope; add a reviewed scope policy first"
                )
            else:
                outside = sorted(
                    path for _, path in changes
                    if not any(path_matches(path, pattern) for pattern in allowed)
                )
                if outside:
                    failures.append(
                        f"branch '{branch}' changed paths outside its approved scope: "
                        + ", ".join(outside)
                    )

    public_roots = tuple(root.rstrip("/") + "/" for root in policy["public_image_roots"])
    for status, path in changes:
        candidate = ROOT / path
        if status == "D" or not candidate.exists():
            continue
        if path.startswith(public_roots) and candidate.suffix.lower() in IMAGE_EXTENSIONS:
            if gps_present(candidate):
                failures.append(f"GPS metadata detected in changed public image: {path}")

    manager_patterns = policy["public_manager_record_paths"]
    for status, path in changes:
        if status == "D":
            continue
        if any(path_matches(path, pattern) for pattern in manager_patterns):
            failures.append(
                f"business-record-shaped file changed in public deployment path: {path}"
            )

    if failures:
        print("\nPRODUCTION INTEGRITY: FAILED", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
    else:
        print("PRODUCTION INTEGRITY: PASSED")
    return failures


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--branch")
    parser.add_argument("--skip-scope", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        failures = check(args.base, args.head, args.branch, args.skip_scope)
    except Exception as exc:
        print(f"PRODUCTION INTEGRITY: ERROR\n- {exc}", file=sys.stderr)
        return 2
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
