# scripts/ — Agent Manifest

## Role
SSOT verification and automation tooling (L5 in permission hierarchy).

## Contents
| File | Function |
|------|----------|
| verify-dual-md.sh | Walk directory tree, flag missing README.md/AGENT.md pairs |
| lint-agent-md.py | Validate AGENT.md structure against .agents/schemas/agent-md.schema.json |
| uniformize.py | Auto-generate stubs for missing AGENT.md files |
| worktree-new.sh | Create isolated git worktree for feature development |
| worktree-list.sh | List all active git worktrees |

## Boundaries
- reads: entire repository (all directories and files)
- writes: uniformize.py may create missing AGENT.md stubs
- NEVER modifies: existing source code, schemas, or agent logic

## Permission Level
L5-scripts: verification tooling; reads everything; writes stubs only
