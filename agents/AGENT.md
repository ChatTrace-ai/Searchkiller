# agents/ — Agent Manifest

## Role
Multi-agent orchestration layer (L1 in permission hierarchy).

## Contents
| Path | Description |
|------|-------------|
| planner/ | Task decomposition + trace emission |
| evaluator/ | HITL judgment + recycle pattern routing |

## Boundaries
- reads: app/, lib/, .agents/schemas/, .agents/traces/, .agents/golden/, .agents/failures/
- writes: .agents/traces/, .agents/golden/, .agents/failures/
- imports_from: lib/ (L3)
- NEVER imported by: app/, components/

## Permission Level
L1-agents: orchestration logic; reads L2+, writes .agents/
