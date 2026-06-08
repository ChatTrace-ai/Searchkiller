#!/usr/bin/env python3
"""lint-agent-md.py — Validate AGENT.md files against structural rules.

Checks:
1. Heading matches '# <dirname>/ — Agent Manifest'
2. Required sections exist: ## Role, ## Contents, ## Boundaries
3. Contents section has a markdown table with at least one row
4. Boundaries section mentions 'reads:' and 'writes:'
"""

import os
import re
import sys
from pathlib import Path

EXCEPTIONS = {"doc", ".git", ".github", "node_modules", ".next", "public"}

def find_agent_mds(root: str) -> list[Path]:
    result = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCEPTIONS and not d.startswith(".git")]
        if "AGENT.md" in filenames:
            result.append(Path(dirpath) / "AGENT.md")
    return result

def lint_agent_md(filepath: Path) -> list[str]:
    errors = []
    content = filepath.read_text(encoding="utf-8")
    lines = content.strip().split("\n")

    dirname = filepath.parent.name
    expected_heading = f"# {dirname}/ — Agent Manifest"
    if not lines or lines[0].strip() != expected_heading:
        errors.append(f"Heading mismatch: expected '{expected_heading}', got '{lines[0].strip() if lines else '(empty)'}'")

    section_pattern = re.compile(r"^## (.+)$")
    sections_found = set()
    for line in lines:
        m = section_pattern.match(line.strip())
        if m:
            sections_found.add(m.group(1).strip().lower())

    for required in ["role", "contents", "boundaries"]:
        if required not in sections_found:
            errors.append(f"Missing required section: ## {required.title()}")

    if "contents" in sections_found:
        has_table = bool(re.search(r"\|.*\|.*\|", content))
        if not has_table:
            errors.append("Contents section should have a markdown table")

    if "boundaries" in sections_found:
        boundaries_block = content.split("## Boundaries")[-1] if "## Boundaries" in content else ""
        if "reads:" not in boundaries_block.lower() and "reads" not in boundaries_block.lower():
            errors.append("Boundaries section missing 'reads' declaration")
        if "writes:" not in boundaries_block.lower() and "writes" not in boundaries_block.lower():
            errors.append("Boundaries section missing 'writes' declaration")

    return errors

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    agent_files = find_agent_mds(root)

    if not agent_files:
        print("No AGENT.md files found.")
        sys.exit(1)

    total_errors = 0
    for filepath in sorted(agent_files):
        rel = filepath.relative_to(root)
        errors = lint_agent_md(filepath)
        if errors:
            print(f"FAIL  {rel}")
            for e in errors:
                print(f"      - {e}")
            total_errors += len(errors)
        else:
            print(f"OK    {rel}")

    print(f"\n=== AGENT.md Lint Results ===")
    print(f"Files checked: {len(agent_files)}")
    print(f"Errors:        {total_errors}")
    print(f"Status:        {'FAIL' if total_errors else 'PASS'}")

    sys.exit(1 if total_errors else 0)

if __name__ == "__main__":
    main()
