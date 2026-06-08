#!/usr/bin/env bash
# worktree-new.sh — Create a new git worktree for isolated feature development.
#
# Usage:
#   bash scripts/worktree-new.sh <feature-name>
#
# Creates:
#   ../Searchkiller-<feature-name>/  (worktree directory)
#   feat/<feature-name>              (branch)
#
# Example:
#   bash scripts/worktree-new.sh hitl-ui
#   # Creates ../Searchkiller-hitl-ui/ on branch feat/hitl-ui
set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <feature-name>"
    echo "  Creates a git worktree at ../Searchkiller-<feature-name>"
    echo "  on branch feat/<feature-name>"
    exit 1
fi

FEATURE="$1"
BRANCH="feat/${FEATURE}"
WORKTREE_DIR="../Searchkiller-${FEATURE}"

REPO_ROOT="$(git rev-parse --show-toplevel)"

if git show-ref --verify --quiet "refs/heads/${BRANCH}" 2>/dev/null; then
    echo "Branch '${BRANCH}' already exists. Attaching worktree..."
    git worktree add "${WORKTREE_DIR}" "${BRANCH}"
else
    echo "Creating new branch '${BRANCH}' and worktree..."
    git worktree add -b "${BRANCH}" "${WORKTREE_DIR}"
fi

echo ""
echo "=== Worktree Created ==="
echo "Directory: $(cd "${WORKTREE_DIR}" && pwd)"
echo "Branch:    ${BRANCH}"
echo ""
echo "Next steps:"
echo "  cd ${WORKTREE_DIR}"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "When done:"
echo "  git worktree remove ${WORKTREE_DIR}"
