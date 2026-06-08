#!/usr/bin/env python3
"""uniformize.py — Auto-generate missing AGENT.md stubs and fix structural drift.

Walks the directory tree and:
1. Reports directories missing README.md or AGENT.md
2. Generates minimal AGENT.md stubs for directories that lack them
3. Optionally generates README.md stubs (with --readme flag)
"""

import os
import sys
from pathlib import Path

EXCEPTIONS = {"doc", ".git", ".github", "node_modules", ".next", "public"}

AGENT_MD_TEMPLATE = """# {dirname}/ — Agent Manifest

## Role
{role}

## Contents
| Name | Description |
|------|-------------|
{contents}

## Boundaries
- reads: [TODO: specify read dependencies]
- writes: [TODO: specify write targets]
"""

README_MD_TEMPLATE = """# {dirname}/

{description}
"""

def should_skip(dirpath: str, root: str) -> bool:
    rel = os.path.relpath(dirpath, root)
    parts = Path(rel).parts
    for part in parts:
        if part in EXCEPTIONS or part.startswith(".git"):
            return True
    return False

def list_contents(dirpath: str) -> str:
    entries = []
    for name in sorted(os.listdir(dirpath)):
        if name.startswith(".") and name not in (".gitkeep",):
            continue
        if name in ("README.md", "AGENT.md"):
            continue
        full = os.path.join(dirpath, name)
        kind = "dir" if os.path.isdir(full) else "file"
        entries.append(f"| {name} | {kind} |")
    return "\n".join(entries) if entries else "| (empty) | — |"

def generate_agent_md(dirpath: str) -> str:
    dirname = os.path.basename(dirpath)
    return AGENT_MD_TEMPLATE.format(
        dirname=dirname,
        role="[TODO: describe this directory's purpose]",
        contents=list_contents(dirpath),
    )

def generate_readme_md(dirpath: str) -> str:
    dirname = os.path.basename(dirpath)
    return README_MD_TEMPLATE.format(
        dirname=dirname,
        description="[TODO: add human-readable description]",
    )

def main():
    root = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "."
    write_readme = "--readme" in sys.argv
    dry_run = "--dry-run" in sys.argv

    created = 0
    skipped = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCEPTIONS and not d.startswith(".git")]

        if dirpath == root:
            continue
        if should_skip(dirpath, root):
            continue

        rel = os.path.relpath(dirpath, root)

        if "AGENT.md" not in filenames:
            agent_path = os.path.join(dirpath, "AGENT.md")
            if dry_run:
                print(f"WOULD CREATE  {rel}/AGENT.md")
            else:
                content = generate_agent_md(dirpath)
                with open(agent_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"CREATED  {rel}/AGENT.md")
            created += 1

        if write_readme and "README.md" not in filenames:
            readme_path = os.path.join(dirpath, "README.md")
            if dry_run:
                print(f"WOULD CREATE  {rel}/README.md")
            else:
                content = generate_readme_md(dirpath)
                with open(readme_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"CREATED  {rel}/README.md")
            created += 1

    print(f"\n=== Uniformize Results ===")
    print(f"Files {'would be ' if dry_run else ''}created: {created}")
    if dry_run:
        print("(dry-run mode — no files were actually written)")

if __name__ == "__main__":
    main()
