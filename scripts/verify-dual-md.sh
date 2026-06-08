#!/usr/bin/env bash
# verify-dual-md.sh — Check that every directory (except doc/) has README.md + AGENT.md
set -euo pipefail

ROOT="${1:-.}"
EXCEPTIONS="doc .git .github node_modules .next public"
EXIT_CODE=0
CHECKED=0
MISSING=0

is_exception() {
    local dir_name
    dir_name="$(basename "$1")"
    local rel_path="${1#$ROOT/}"
    for exc in $EXCEPTIONS; do
        if [[ "$dir_name" == "$exc" ]] || [[ "$rel_path" == "$exc"* ]]; then
            return 0
        fi
    done
    return 1
}

while IFS= read -r dir; do
    [[ "$dir" == "$ROOT" ]] && continue
    is_exception "$dir" && continue

    CHECKED=$((CHECKED + 1))
    missing_files=""

    if [[ ! -f "$dir/README.md" ]]; then
        missing_files="README.md"
    fi
    if [[ ! -f "$dir/AGENT.md" ]]; then
        if [[ -n "$missing_files" ]]; then
            missing_files="$missing_files, AGENT.md"
        else
            missing_files="AGENT.md"
        fi
    fi

    if [[ -n "$missing_files" ]]; then
        rel="${dir#$ROOT/}"
        echo "FAIL  $rel/ — missing: $missing_files"
        MISSING=$((MISSING + 1))
        EXIT_CODE=1
    fi
done < <(find "$ROOT" -type d -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.next/*')

echo ""
echo "=== Dual-Markdown Verification ==="
echo "Directories checked: $CHECKED"
echo "Missing pairs:       $MISSING"

if [[ $EXIT_CODE -eq 0 ]]; then
    echo "Status: PASS"
else
    echo "Status: FAIL"
fi

exit $EXIT_CODE
