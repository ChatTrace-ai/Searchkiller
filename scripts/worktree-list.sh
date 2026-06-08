#!/usr/bin/env bash
# worktree-list.sh — List all active git worktrees for this repository.
set -euo pipefail

echo "=== Active Worktrees ==="
git worktree list

echo ""
echo "To remove a worktree:"
echo "  git worktree remove <path>"
echo ""
echo "To prune stale entries:"
echo "  git worktree prune"
