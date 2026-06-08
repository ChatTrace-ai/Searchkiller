# agents/ — Agent Manifest

## Role
Multi-agent orchestration layer (L1 in permission hierarchy).

## Contents
| Path | Description |
|------|-------------|
| planner/ | Task decomposition + trace emission |
| evaluator/ | HITL-initialized autonomous judgment + recycle pattern routing |
| mcp/ | MCP bridges (Playwright test runner) |
| recycle.ts | Recycle pattern engine (plan → evaluate → route) |

## Boundaries
- reads: app/, lib/, .agents/schemas/, .agents/traces/, .agents/golden/, .agents/failures/
- writes: .agents/traces/, .agents/golden/, .agents/failures/
- imports_from: lib/ (L3)
- NEVER imported by: app/, components/

## Permission Level
L1-agents: orchestration logic; reads L2+, writes .agents/
