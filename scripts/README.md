# scripts/ — SSOT Verification & Automation

Lightweight scripts for auditing, linting, and auto-fixing structural consistency across the repository.

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `verify-dual-md.sh` | Checks every directory has README.md + AGENT.md | `bash scripts/verify-dual-md.sh` |
| `lint-agent-md.py` | Validates AGENT.md files against JSON schema | `python scripts/lint-agent-md.py` |
| `uniformize.py` | Auto-generates missing AGENT.md stubs | `python scripts/uniformize.py` |
| `worktree-new.sh` | Creates isolated git worktree for features | `bash scripts/worktree-new.sh <name>` |
| `worktree-list.sh` | Lists all active git worktrees | `bash scripts/worktree-list.sh` |

## Invocation

Can be run by humans or agents. All scripts are read-only against the codebase (except `uniformize.py` which writes stubs for missing files).
